import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { BookingStatus, HoldStatus, Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import * as QRCode from 'qrcode';
import { PrismaService } from '../database/prisma.service';
import { AvailabilityService } from '../availability/availability.service';
import { CouponsService } from '../coupons/coupons.service';
import { CreateHoldDto } from './dto/create-hold.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { RescheduleBookingDto } from './dto/reschedule-booking.dto';
import { BookingQueryDto } from './dto/booking-query.dto';
import { CalculateQuoteDto } from './dto/calculate-quote.dto';
import { Role } from '../common/enums/role.enum';

export interface FeeBreakdownItem {
  name: string;
  amount: number;
}

export interface FeeBreakdown {
  turfPrice: number;
  basePrice: number;
  platformFee: number;
  platformFeeRate: number; // 0.10 (10%)
  taxes: number;
  taxAmount: number;
  taxRate: number; // 0.18 (18% GST)
  customFees: number;
  discountAmount: number;
  totalAmount: number;
  totalPrice: number;
  items: FeeBreakdownItem[];
}

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availabilityService: AvailabilityService,
    @Optional() private readonly couponsService?: CouponsService,
  ) {}

  calculateFeeBreakdown(
    turfPrice: number,
    discountAmount = 0,
    customFeeItems?: { name: string; amount: number }[],
  ): FeeBreakdown {
    const base = Math.round(Number(turfPrice) * 100) / 100;
    const platformFeeRate = 0.1; // 10% Platform Fee
    const platformFee = Math.round(base * platformFeeRate * 100) / 100;
    const taxRate = 0.18; // 18% GST on platform fee
    const taxes = Math.round(platformFee * taxRate * 100) / 100;

    let customFeesTotal = 0;
    const customItems: FeeBreakdownItem[] = [];
    if (customFeeItems && customFeeItems.length > 0) {
      for (const item of customFeeItems) {
        const amt = Math.max(0, Math.round(Number(item.amount) * 100) / 100);
        customFeesTotal += amt;
        customItems.push({ name: item.name, amount: amt });
      }
    }

    const discount = Math.min(
      base,
      Math.max(0, Math.round(Number(discountAmount) * 100) / 100),
    );

    const totalAmount =
      Math.round(
        (base + platformFee + taxes + customFeesTotal - discount) * 100,
      ) / 100;

    const items: FeeBreakdownItem[] = [
      { name: 'Turf Price', amount: base },
      { name: 'Platform Fee (10%)', amount: platformFee },
      { name: 'Taxes', amount: taxes },
      ...customItems,
    ];

    if (discount > 0) {
      items.push({ name: 'Discount', amount: -discount });
    }

    return {
      turfPrice: base,
      basePrice: base,
      platformFee,
      platformFeeRate,
      taxes,
      taxAmount: taxes,
      taxRate,
      customFees: customFeesTotal,
      discountAmount: discount,
      totalAmount,
      totalPrice: totalAmount,
      items,
    };
  }

  // ---------------------------------------------------------------------------
  // HELPER UTILITIES
  // ---------------------------------------------------------------------------

  private generateBookingNumber(): string {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomHex = randomBytes(4).toString('hex').toUpperCase();
    return `TB-${dateStr}-${randomHex}`;
  }

  private generateHoldCode(): string {
    const randomHex = randomBytes(6).toString('hex').toUpperCase();
    return `HOLD-${randomHex}`;
  }

  private formatDateIso(d: Date): string {
    return d.toISOString().split('T')[0];
  }

  /**
   * Lazily marks expired holds as EXPIRED and releases active_hold_key
   */
  async expireStaleHolds(
    turfId?: string,
    holdDate?: string,
    startTime?: string,
  ) {
    const where: Prisma.SlotHoldWhereInput = {
      status: HoldStatus.ACTIVE,
      expiresAt: { lt: new Date() },
    };

    if (turfId) where.turfId = turfId;
    if (holdDate) where.holdDate = new Date(holdDate);
    if (startTime) where.startTime = startTime;

    await this.prisma.slotHold.updateMany({
      where,
      data: {
        status: HoldStatus.EXPIRED,
        activeHoldKey: null,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // TEMPORARY SLOT HOLD APIS
  // ---------------------------------------------------------------------------

  /**
   * POST /api/v1/booking/holds
   * Creates a temporary 10-minute slot hold with PostgreSQL advisory locking to prevent race conditions.
   */
  async createHold(userId: string, dto: CreateHoldDto) {
    // 1. Idempotency Check
    if (dto.idempotencyKey) {
      const existingHold = await this.prisma.slotHold.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
      });
      if (existingHold) {
        if (
          existingHold.expiresAt > new Date() &&
          existingHold.status === HoldStatus.ACTIVE
        ) {
          return existingHold;
        }
      }
    }

    const holdDateStr = dto.holdDate;
    const targetDate = new Date(holdDateStr);
    const dayOfWeek = targetDate.getDay();

    return this.prisma.$transaction(async (tx) => {
      // 2. PostgreSQL Advisory Lock on (turfId + date + startTime)
      const lockKey = `turf_slot_${dto.turfId}_${holdDateStr}_${dto.startTime}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

      // 3. Expire stale holds on this exact slot
      await tx.slotHold.updateMany({
        where: {
          turfId: dto.turfId,
          holdDate: targetDate,
          startTime: dto.startTime,
          status: HoldStatus.ACTIVE,
          expiresAt: { lt: new Date() },
        },
        data: {
          status: HoldStatus.EXPIRED,
          activeHoldKey: null,
        },
      });

      // 4. Verify turf exists and is active
      const turf = await tx.turf.findFirst({
        where: { id: dto.turfId, isActive: true, deletedAt: null },
        include: {
          operatingHours: { where: { dayOfWeek } },
          blockedSlots: {
            where: { blockDate: targetDate },
          },
        },
      });

      if (!turf) {
        throw new NotFoundException(`Turf venue not found or inactive`);
      }

      // 5. Verify operating hours
      const oh = turf.operatingHours[0];
      if (!oh || oh.isClosed) {
        throw new BadRequestException(
          'Turf venue is closed on the selected date',
        );
      }

      // 6. Verify not blocked for maintenance or tournament
      const isBlocked = turf.blockedSlots.some(
        (b) => dto.startTime < b.endTime && dto.endTime > b.startTime,
      );
      if (isBlocked) {
        throw new ConflictException(
          'Slot is blocked for maintenance or venue hold',
        );
      }

      // 7. Check for conflicting ACTIVE hold
      const activeHold = await tx.slotHold.findFirst({
        where: {
          turfId: dto.turfId,
          holdDate: targetDate,
          startTime: dto.startTime,
          status: HoldStatus.ACTIVE,
          expiresAt: { gt: new Date() },
        },
      });

      if (activeHold) {
        if (activeHold.userId === userId) {
          return activeHold; // Re-use own active hold
        }
        throw new ConflictException(
          'This timeslot is temporarily held by another customer. Please choose another slot or try again shortly.',
        );
      }

      // 8. Check for conflicting CONFIRMED / PENDING booking
      const activeBooking = await tx.booking.findFirst({
        where: {
          turfId: dto.turfId,
          bookingDate: targetDate,
          startTime: dto.startTime,
          status: {
            in: [
              BookingStatus.CONFIRMED,
              BookingStatus.PENDING,
              BookingStatus.PAYMENT_PENDING,
            ],
          },
        },
      });

      if (activeBooking) {
        throw new ConflictException('This timeslot has already been booked');
      }

      // 9. Calculate slot price
      const slotsOverview = await this.availabilityService.getAvailableSlots(
        dto.turfId,
        {
          date: holdDateStr,
          sportId: dto.sportId,
        },
      );

      const matchedSlot = slotsOverview.slots.find(
        (s) => s.startTime === dto.startTime,
      );
      const calculatedPrice = matchedSlot ? matchedSlot.price : 1000;

      // 10. Create the SlotHold with 10-minute TTL
      const ttlMinutes = 10;
      const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
      const activeHoldKey = `${dto.turfId}_${holdDateStr}_${dto.startTime}`;

      const hold = await tx.slotHold.create({
        data: {
          holdCode: this.generateHoldCode(),
          userId,
          turfId: dto.turfId,
          sportId: dto.sportId ?? null,
          holdDate: targetDate,
          startTime: dto.startTime,
          endTime: dto.endTime,
          expiresAt,
          status: HoldStatus.ACTIVE,
          totalPrice: calculatedPrice,
          idempotencyKey: dto.idempotencyKey ?? null,
          activeHoldKey,
        },
      });

      const feeBreakdown = this.calculateFeeBreakdown(calculatedPrice);

      return {
        ...hold,
        feeBreakdown,
      };
    });
  }

  /**
   * GET /api/v1/booking/holds/:id
   * Retrieves hold details and lazily handles expiration.
   */
  async getHoldById(userId: string, userRoles: string[], holdId: string) {
    const hold = await this.prisma.slotHold.findUnique({
      where: { id: holdId },
      include: {
        turf: {
          select: { id: true, name: true, addressLine: true, city: true },
        },
      },
    });

    if (!hold) {
      throw new NotFoundException(`Hold record "${holdId}" not found`);
    }

    const isPlatformAdmin =
      userRoles.includes(Role.SUPER_ADMIN) || userRoles.includes(Role.ADMIN);

    if (!isPlatformAdmin && hold.userId !== userId) {
      throw new ForbiddenException('You are not authorized to view this hold');
    }

    // Lazy expiration check
    if (hold.status === HoldStatus.ACTIVE && hold.expiresAt < new Date()) {
      const expired = await this.prisma.slotHold.update({
        where: { id: holdId },
        data: {
          status: HoldStatus.EXPIRED,
          activeHoldKey: null,
        },
      });
      return {
        ...expired,
        feeBreakdown: this.calculateFeeBreakdown(Number(expired.totalPrice)),
      };
    }

    return {
      ...hold,
      feeBreakdown: this.calculateFeeBreakdown(Number(hold.totalPrice)),
    };
  }

  /**
   * DELETE /api/v1/booking/holds/:id
   * Customer releases temporary hold voluntarily.
   */
  async releaseHold(userId: string, userRoles: string[], holdId: string) {
    const hold = await this.prisma.slotHold.findUnique({
      where: { id: holdId },
    });

    if (!hold) {
      throw new NotFoundException(`Hold record "${holdId}" not found`);
    }

    const isPlatformAdmin =
      userRoles.includes(Role.SUPER_ADMIN) || userRoles.includes(Role.ADMIN);

    if (!isPlatformAdmin && hold.userId !== userId) {
      throw new ForbiddenException(
        'You are not authorized to release this hold',
      );
    }

    const updated = await this.prisma.slotHold.update({
      where: { id: holdId },
      data: {
        status: HoldStatus.RELEASED,
        activeHoldKey: null,
      },
    });

    return {
      message:
        'Hold released successfully. Slot is now available for other customers.',
      hold: updated,
    };
  }

  // ---------------------------------------------------------------------------
  // BOOKING APIS
  // ---------------------------------------------------------------------------

  /**
   * POST /api/v1/bookings
   * Confirms a booking atomically from an active hold or direct slot reservation.
   * Guarantees zero double booking via PostgreSQL advisory locking + unique constraints.
   */
  async createBooking(userId: string, dto: CreateBookingDto) {
    // 1. Idempotency Check
    if (dto.idempotencyKey) {
      const existing = await this.prisma.booking.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
        include: {
          turf: true,
          statusHistory: { orderBy: { createdAt: 'asc' } },
        },
      });
      if (existing) {
        return existing;
      }
    }

    return this.prisma.$transaction(async (tx) => {
      let turfId = dto.turfId;
      let bookingDateStr = dto.bookingDate;
      let startTime = dto.startTime;
      let endTime = dto.endTime;
      let sportId = dto.sportId;
      let totalPrice = 1000;
      let slotHoldId: string | null = null;

      // FLOW A: Booking from active SlotHold
      if (dto.holdId) {
        slotHoldId = dto.holdId;
        const hold = await tx.slotHold.findUnique({
          where: { id: dto.holdId },
        });

        if (!hold) {
          throw new NotFoundException(
            `SlotHold record "${dto.holdId}" not found`,
          );
        }

        if (hold.userId !== userId) {
          throw new ForbiddenException(
            'You cannot confirm a hold belonging to another user',
          );
        }

        if (hold.status !== HoldStatus.ACTIVE || hold.expiresAt < new Date()) {
          await tx.slotHold.update({
            where: { id: hold.id },
            data: { status: HoldStatus.EXPIRED, activeHoldKey: null },
          });
          throw new GoneException(
            'Your hold has expired. Please select and hold the slot again.',
          );
        }

        turfId = hold.turfId;
        bookingDateStr = this.formatDateIso(hold.holdDate);
        startTime = hold.startTime;
        endTime = hold.endTime;
        sportId = hold.sportId ?? undefined;
        totalPrice = Number(hold.totalPrice);

        // Acquire advisory lock
        const lockKey = `turf_slot_${turfId}_${bookingDateStr}_${startTime}`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

        // Mark hold CONVERTED
        await tx.slotHold.update({
          where: { id: hold.id },
          data: {
            status: HoldStatus.CONVERTED,
            activeHoldKey: null,
          },
        });
      } else {
        // FLOW B: Direct Booking (requires turfId, bookingDate, startTime, endTime)
        if (!turfId || !bookingDateStr || !startTime || !endTime) {
          throw new BadRequestException(
            'Either holdId or complete slot details (turfId, bookingDate, startTime, endTime) must be provided',
          );
        }

        // Acquire advisory lock
        const lockKey = `turf_slot_${turfId}_${bookingDateStr}_${startTime}`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

        // Check active hold by another user
        const activeHold = await tx.slotHold.findFirst({
          where: {
            turfId,
            holdDate: new Date(bookingDateStr),
            startTime,
            status: HoldStatus.ACTIVE,
            expiresAt: { gt: new Date() },
          },
        });

        if (activeHold && activeHold.userId !== userId) {
          throw new ConflictException(
            'This timeslot is temporarily held by another customer. Please choose another slot.',
          );
        }

        // Calculate dynamic price
        const slotsOverview = await this.availabilityService.getAvailableSlots(
          turfId,
          {
            date: bookingDateStr,
            sportId,
          },
        );

        const matchedSlot = slotsOverview.slots.find(
          (s) => s.startTime === startTime,
        );
        if (!matchedSlot || !matchedSlot.isAvailable) {
          throw new ConflictException(
            'This timeslot is not available for booking',
          );
        }
        totalPrice = matchedSlot.price;
      }

      // Check for duplicate active booking
      const targetDate = new Date(bookingDateStr);
      const existingActiveBooking = await tx.booking.findFirst({
        where: {
          turfId: turfId,
          bookingDate: targetDate,
          startTime: startTime,
          status: {
            in: [
              BookingStatus.CONFIRMED,
              BookingStatus.PENDING,
              BookingStatus.PAYMENT_PENDING,
            ],
          },
        },
      });

      if (existingActiveBooking) {
        throw new ConflictException(
          'Slot has already been booked. Two confirmed bookings cannot share the same turf slot.',
        );
      }

      let discountAmount = 0;
      if (dto.couponCode && this.couponsService) {
        try {
          const couponRes = await this.couponsService.validateCoupon(
            {
              code: dto.couponCode,
              amount: totalPrice,
              turfId,
              sportType: sportId,
            },
            userId,
          );
          if (couponRes && couponRes.valid) {
            discountAmount = couponRes.discountAmount;
          }
        } catch {
          // ignore error and proceed without discount
        }
      }

      const feeBreakdown = this.calculateFeeBreakdown(
        totalPrice,
        discountAmount,
        dto.customFeeItems,
      );

      const activeSlotKey = `${turfId}_${bookingDateStr}_${startTime}`;
      const bookingNumber = this.generateBookingNumber();

      const booking = await tx.booking.create({
        data: {
          bookingNumber,
          userId,
          turfId: turfId,
          sportId: sportId ?? null,
          slotHoldId,
          bookingDate: targetDate,
          startTime: startTime,
          endTime: endTime,
          status: BookingStatus.CONFIRMED,
          activeSlotKey,
          idempotencyKey: dto.idempotencyKey ?? null,
          basePrice: feeBreakdown.basePrice,
          taxAmount: feeBreakdown.taxAmount,
          discountAmount: feeBreakdown.discountAmount,
          totalPrice: feeBreakdown.totalAmount,
        },
        include: {
          turf: {
            select: {
              id: true,
              name: true,
              coverImageUrl: true,
              addressLine: true,
              city: true,
              images: {
                where: { isCover: true },
                take: 1,
              },
            },
          },
        },
      });

      // Audit status transition in history
      await tx.bookingStatusHistory.create({
        data: {
          bookingId: booking.id,
          fromStatus: null,
          toStatus: BookingStatus.CONFIRMED,
          reason: slotHoldId
            ? 'Booking confirmed from temporary slot hold'
            : 'Direct booking confirmed',
          changedByUserId: userId,
        },
      });

      let qrCodeDataUrl: string | null = null;
      try {
        qrCodeDataUrl = await QRCode.toDataURL(booking.bookingNumber, {
          width: 320,
          margin: 2,
          color: { dark: '#000000', light: '#ffffff' },
        });
      } catch {
        qrCodeDataUrl = null;
      }

      return {
        ...booking,
        qrCodeDataUrl,
        paymentMethod: 'UPI',
        paymentStatus: 'PAID',
        feeBreakdown,
      };
    });
  }

  /**
   * POST /api/v1/bookings/calculate-quote
   * Computes the exact pre-checkout price quote and fee breakdown.
   */
  async calculateQuote(userId: string, dto: CalculateQuoteDto) {
    let turfId = dto.turfId;
    let targetDateStr = dto.date || dto.bookingDate;
    let startTime = dto.startTime;
    let endTime = dto.endTime;
    let sportId = dto.sportId;
    let basePrice = 1000;
    let holdRecord: any = null;

    if (dto.holdId) {
      const hold = await this.prisma.slotHold.findUnique({
        where: { id: dto.holdId },
        include: {
          turf: {
            select: { id: true, name: true, addressLine: true, city: true },
          },
          sport: true,
        },
      });

      if (!hold) {
        throw new NotFoundException(`SlotHold record "${dto.holdId}" not found`);
      }

      if (hold.status !== HoldStatus.ACTIVE || hold.expiresAt < new Date()) {
        throw new GoneException(
          'Your hold has expired. Please select and hold the slot again.',
        );
      }

      turfId = hold.turfId;
      targetDateStr = this.formatDateIso(hold.holdDate);
      startTime = hold.startTime;
      endTime = hold.endTime;
      sportId = hold.sportId ?? undefined;
      basePrice = Number(hold.totalPrice);
      holdRecord = hold;
    } else {
      if (!turfId || !targetDateStr || !startTime) {
        throw new BadRequestException(
          'Either holdId or (turfId, date/bookingDate, startTime) must be provided',
        );
      }

      const turf = await this.prisma.turf.findFirst({
        where: { id: turfId, isActive: true, deletedAt: null },
      });

      if (!turf) {
        throw new NotFoundException(`Turf venue "${turfId}" not found`);
      }

      const slotsOverview = await this.availabilityService.getAvailableSlots(
        turfId,
        {
          date: targetDateStr,
          sportId,
        },
      );

      const matchedSlot = slotsOverview.slots.find(
        (s) => s.startTime === startTime,
      );

      basePrice = matchedSlot ? matchedSlot.price : 1000;
    }

    // Coupon discount calculation if couponCode provided
    let discountAmount = 0;
    let couponDetails: any = null;

    if (dto.couponCode && this.couponsService) {
      try {
        const couponRes = await this.couponsService.validateCoupon(
          {
            code: dto.couponCode,
            amount: basePrice,
            turfId,
            sportType: sportId,
          },
          userId,
        );
        if (couponRes && couponRes.valid) {
          discountAmount = couponRes.discountAmount;
          couponDetails = {
            code: dto.couponCode,
            discountAmount: couponRes.discountAmount,
            isValid: true,
          };
        } else {
          couponDetails = {
            code: dto.couponCode,
            discountAmount: 0,
            isValid: false,
            reason: couponRes?.message || 'Invalid coupon',
          };
        }
      } catch {
        couponDetails = {
          code: dto.couponCode,
          discountAmount: 0,
          isValid: false,
          reason: 'Coupon validation failed',
        };
      }
    }

    const feeBreakdown = this.calculateFeeBreakdown(
      basePrice,
      discountAmount,
      dto.customFeeItems,
    );

    return {
      turfId,
      bookingDate: targetDateStr,
      startTime,
      endTime,
      sportId,
      holdId: dto.holdId ?? null,
      holdExpiresAt: holdRecord ? holdRecord.expiresAt : null,
      coupon: couponDetails,
      feeBreakdown,
    };
  }

  /**
   * GET /api/v1/bookings
   * Lists bookings with pagination, status filtering, and role-based access.
   */
  async findAll(userId: string, userRoles: string[], query: BookingQueryDto) {
    const isPlatformAdmin =
      userRoles.includes(Role.SUPER_ADMIN) || userRoles.includes(Role.ADMIN);
    const isTurfOwner = userRoles.includes(Role.TURF_OWNER);

    const where: Prisma.BookingWhereInput = {
      deletedAt: null,
    };

    if (query.status) {
      where.status = query.status;
    }
    if (query.turfId) {
      where.turfId = query.turfId;
    }
    if (query.date) {
      where.bookingDate = new Date(query.date);
    }

    if (!isPlatformAdmin) {
      if (isTurfOwner) {
        // Turf owners see bookings for their turfs
        where.turf = {
          owner: { userId },
        };
      } else {
        // Customers only see their own bookings
        where.userId = userId;
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          turf: {
            select: {
              id: true,
              name: true,
              coverImageUrl: true,
              addressLine: true,
              city: true,
              images: {
                where: { isCover: true },
                take: 1,
              },
            },
          },
          sport: {
            select: { id: true, name: true },
          },
        },
      }),
      this.prisma.booking.count({ where }),
    ]);

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const totalPages = Math.ceil(total / limit) || 1;

    return {
      items,
      meta: {
        page,
        limit,
        totalItems: total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * GET /api/v1/bookings/:id
   * Retrieves full booking details including auditable status history.
   */
  async findOne(userId: string, userRoles: string[], id: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id, deletedAt: null },
      include: {
        turf: {
          include: {
            owner: true,
            city: true,
            images: {
              where: { isCover: true },
              take: 1,
            },
          },
        },
        sport: true,
        user: {
          select: { id: true, fullName: true, email: true, phone: true },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        statusHistory: {
          orderBy: { createdAt: 'asc' },
          include: {
            changedByUser: {
              select: { id: true, fullName: true, email: true },
            },
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException(`Booking with ID "${id}" not found`);
    }

    const isPlatformAdmin =
      userRoles.includes(Role.SUPER_ADMIN) || userRoles.includes(Role.ADMIN);
    const isTurfOwner = booking.turf.owner.userId === userId;
    const isBookingCustomer = booking.userId === userId;

    if (!isPlatformAdmin && !isTurfOwner && !isBookingCustomer) {
      throw new ForbiddenException(
        'You are not authorized to view this booking',
      );
    }

    let qrCodeDataUrl: string | null = null;
    try {
      qrCodeDataUrl = await QRCode.toDataURL(booking.bookingNumber, {
        width: 320,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      });
    } catch {
      qrCodeDataUrl = null;
    }

    const latestPayment = (booking as any).payments?.[0];

    return {
      ...booking,
      qrCodeDataUrl,
      paymentMethod: latestPayment?.provider || 'UPI',
      paymentStatus: latestPayment?.status || 'PAID',
    };
  }

  /**
   * GET /api/v1/bookings/:id/status
   * Lightweight status inquiry endpoint.
   */
  async getBookingStatus(userId: string, userRoles: string[], id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      select: {
        id: true,
        bookingNumber: true,
        status: true,
        userId: true,
        updatedAt: true,
        turf: {
          select: {
            owner: { select: { userId: true } },
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException(`Booking with ID "${id}" not found`);
    }

    const isPlatformAdmin =
      userRoles.includes(Role.SUPER_ADMIN) || userRoles.includes(Role.ADMIN);
    const isTurfOwner = booking.turf.owner.userId === userId;
    const isBookingCustomer = booking.userId === userId;

    if (!isPlatformAdmin && !isTurfOwner && !isBookingCustomer) {
      throw new ForbiddenException(
        'You are not authorized to check status of this booking',
      );
    }

    return {
      bookingId: booking.id,
      bookingNumber: booking.bookingNumber,
      status: booking.status,
      updatedAt: booking.updatedAt,
    };
  }

  /**
   * POST /api/v1/bookings/:id/cancel
   * Cancels a booking, releases the activeSlotKey, and logs the status change.
   */
  async cancelBooking(
    userId: string,
    userRoles: string[],
    id: string,
    dto: CancelBookingDto,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        turf: {
          include: { owner: true },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException(`Booking with ID "${id}" not found`);
    }

    const isPlatformAdmin =
      userRoles.includes(Role.SUPER_ADMIN) || userRoles.includes(Role.ADMIN);
    const isTurfOwner = booking.turf.owner.userId === userId;
    const isBookingCustomer = booking.userId === userId;

    if (!isPlatformAdmin && !isTurfOwner && !isBookingCustomer) {
      throw new ForbiddenException(
        'You are not authorized to cancel this booking',
      );
    }

    if (
      booking.status === BookingStatus.CANCELLED ||
      booking.status === BookingStatus.COMPLETED ||
      booking.status === BookingStatus.REFUNDED
    ) {
      throw new BadRequestException(
        `Cannot cancel a booking in "${booking.status}" status`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({
        where: { id },
        data: {
          status: BookingStatus.CANCELLED,
          activeSlotKey: null, // Frees the slot immediately for others!
          cancellationReason: dto.reason || 'User cancelled',
          cancelledAt: new Date(),
        },
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: id,
          fromStatus: booking.status,
          toStatus: BookingStatus.CANCELLED,
          reason: dto.reason || 'Customer cancellation',
          changedByUserId: userId,
        },
      });

      return updated;
    });
  }

  /**
   * POST /api/v1/bookings/:id/reschedule
   * Atomically reschedules an active booking to a new date and time slot.
   */
  async rescheduleBooking(
    userId: string,
    userRoles: string[],
    id: string,
    dto: RescheduleBookingDto,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        turf: {
          include: { owner: true },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException(`Booking with ID "${id}" not found`);
    }

    const isPlatformAdmin =
      userRoles.includes(Role.SUPER_ADMIN) || userRoles.includes(Role.ADMIN);
    const isTurfOwner = booking.turf.owner.userId === userId;
    const isBookingCustomer = booking.userId === userId;

    if (!isPlatformAdmin && !isTurfOwner && !isBookingCustomer) {
      throw new ForbiddenException(
        'You are not authorized to reschedule this booking',
      );
    }

    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException(
        'Only CONFIRMED bookings can be rescheduled',
      );
    }

    const newTargetDate = new Date(dto.newDate);
    const newLockKey = `turf_slot_${booking.turfId}_${dto.newDate}_${dto.newStartTime}`;

    return this.prisma.$transaction(async (tx) => {
      // 1. Acquire advisory lock on new target slot
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${newLockKey}))`;

      // 2. Check availability on new slot
      const existingHold = await tx.slotHold.findFirst({
        where: {
          turfId: booking.turfId,
          holdDate: newTargetDate,
          startTime: dto.newStartTime,
          status: HoldStatus.ACTIVE,
          expiresAt: { gt: new Date() },
        },
      });

      if (existingHold) {
        throw new ConflictException(
          'New requested slot is temporarily held by another customer',
        );
      }

      const existingBooking = await tx.booking.findFirst({
        where: {
          turfId: booking.turfId,
          bookingDate: newTargetDate,
          startTime: dto.newStartTime,
          status: {
            in: [
              BookingStatus.CONFIRMED,
              BookingStatus.PENDING,
              BookingStatus.PAYMENT_PENDING,
            ],
          },
        },
      });

      if (existingBooking) {
        throw new ConflictException('New requested slot is already booked');
      }

      // 3. Free old slot key and assign new slot key
      const newActiveSlotKey = `${booking.turfId}_${dto.newDate}_${dto.newStartTime}`;

      const updated = await tx.booking.update({
        where: { id },
        data: {
          bookingDate: newTargetDate,
          startTime: dto.newStartTime,
          endTime: dto.newEndTime,
          activeSlotKey: newActiveSlotKey,
        },
      });

      // 4. Record auditable transition
      const oldDateStr = this.formatDateIso(booking.bookingDate);
      await tx.bookingStatusHistory.create({
        data: {
          bookingId: id,
          fromStatus: BookingStatus.CONFIRMED,
          toStatus: BookingStatus.CONFIRMED,
          reason: `Rescheduled from ${oldDateStr} ${booking.startTime} to ${dto.newDate} ${dto.newStartTime}`,
          changedByUserId: userId,
        },
      });

      return updated;
    });
  }
}
