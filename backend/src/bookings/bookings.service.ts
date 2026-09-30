import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { BookingStatus, HoldStatus, PaymentStatus, Prisma } from '@prisma/client';
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
import { BookingTimeSlotDto } from './dto/booking-time-slot.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import {
  CompleteBookingPaymentDto,
  PaymentMethodType,
} from './dto/complete-payment.dto';
import { PaymentsService } from '../payments/payments.service';
import { NotificationsService } from '../notifications/notifications.service';
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
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly availabilityService: AvailabilityService,
    @Optional() private readonly couponsService?: CouponsService,
    @Optional() private readonly paymentsService?: PaymentsService,
    @Optional() private readonly notificationsService?: NotificationsService,
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

  private parseSlotMinutes(timeStr: string): number {
    if (!timeStr) return 0;
    const parts = timeStr.trim().split(':').map(Number);
    const hours = parts[0] || 0;
    const minutes = parts[1] || 0;
    return hours * 60 + minutes;
  }

  private calculateDurationMinutes(startTime: string, endTime: string): number {
    const startM = this.parseSlotMinutes(startTime);
    let endM = this.parseSlotMinutes(endTime);
    if ((endTime === '00:00' || endTime === '24:00') && startM > 0) {
      endM = 24 * 60;
    } else if (endM <= startM) {
      endM += 24 * 60; // Handle midnight wrap
    }
    return Math.max(1, endM - startM);
  }

  private getTimeIntervals(startStr: string, endStr: string): Array<[number, number]> {
    const start = this.parseSlotMinutes(startStr);
    let end = this.parseSlotMinutes(endStr);

    if ((endStr === '00:00' || endStr === '24:00') && start > 0) {
      end = 24 * 60;
    }

    if (start === end) {
      return [];
    }

    if (end > start) {
      if (end <= 24 * 60) {
        return [[start, end]];
      } else {
        return [
          [start, 24 * 60],
          [0, end % (24 * 60)],
        ];
      }
    } else {
      // Midnight wrap (e.g. 23:00 to 01:00 => [1380, 1440] and [0, 60])
      return [
        [start, 24 * 60],
        [0, end],
      ];
    }
  }

  private isOverlapping(
    sStart: string,
    sEnd: string,
    oStart: string,
    oEnd: string,
  ): boolean {
    const intervals1 = this.getTimeIntervals(sStart, sEnd);
    const intervals2 = this.getTimeIntervals(oStart, oEnd);

    for (const [aStart, aEnd] of intervals1) {
      for (const [bStart, bEnd] of intervals2) {
        if (Math.max(aStart, bStart) < Math.min(aEnd, bEnd)) {
          return true;
        }
      }
    }
    return false;
  }

  private isSlotOverlappingWithBooking(
    sStart: string,
    sEnd: string,
    booking: { startTime: string; endTime: string; timeSlots?: any },
  ): boolean {
    let slots = booking.timeSlots;
    if (typeof slots === 'string') {
      try {
        slots = JSON.parse(slots);
      } catch {
        slots = null;
      }
    }
    if (Array.isArray(slots) && slots.length > 0) {
      return slots.some((ts: any) =>
        ts?.startTime && ts?.endTime
          ? this.isOverlapping(sStart, sEnd, ts.startTime, ts.endTime)
          : false,
      );
    }
    return this.isOverlapping(sStart, sEnd, booking.startTime, booking.endTime);
  }

  private isSlotOverlappingWithHold(
    sStart: string,
    sEnd: string,
    hold: { startTime: string; endTime: string; timeSlots?: any },
  ): boolean {
    let slots = hold.timeSlots;
    if (typeof slots === 'string') {
      try {
        slots = JSON.parse(slots);
      } catch {
        slots = null;
      }
    }
    if (Array.isArray(slots) && slots.length > 0) {
      return slots.some((ts: any) =>
        ts?.startTime && ts?.endTime
          ? this.isOverlapping(sStart, sEnd, ts.startTime, ts.endTime)
          : false,
      );
    }
    return this.isOverlapping(sStart, sEnd, hold.startTime, hold.endTime);
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

    const rawSlots =
      dto.timeSlots && dto.timeSlots.length > 0
        ? dto.timeSlots
        : dto.startTime && dto.endTime
          ? [{ startTime: dto.startTime, endTime: dto.endTime, price: undefined }]
          : [];

    if (rawSlots.length === 0) {
      throw new BadRequestException(
        'Either startTime & endTime or timeSlots must be provided',
      );
    }

    const sortedSlots = [...rawSlots].sort((a, b) =>
      a.startTime.localeCompare(b.startTime),
    );

    return this.prisma.$transaction(async (tx) => {
      // 2. PostgreSQL Advisory Lock on all requested slots
      for (const slot of sortedSlots) {
        const lockKey = `turf_slot_${dto.turfId}_${holdDateStr}_${slot.startTime}`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

        // 3. Expire stale holds on this exact slot
        await tx.slotHold.updateMany({
          where: {
            turfId: dto.turfId,
            holdDate: targetDate,
            startTime: slot.startTime,
            status: HoldStatus.ACTIVE,
            expiresAt: { lt: new Date() },
          },
          data: {
            status: HoldStatus.EXPIRED,
            activeHoldKey: null,
          },
        });
      }

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

      // 6. Verify not blocked for maintenance or tournament for any slot
      for (const slot of sortedSlots) {
        const isBlocked = turf.blockedSlots.some(
          (b) => slot.startTime < b.endTime && slot.endTime > b.startTime,
        );
        if (isBlocked) {
          throw new ConflictException(
            `Slot ${slot.startTime} - ${slot.endTime} is blocked for maintenance or venue hold`,
          );
        }
      }

      // 7. Check for conflicting ACTIVE hold & active booking for any slot
      const existingHolds = await tx.slotHold.findMany({
        where: {
          turfId: dto.turfId,
          holdDate: targetDate,
          status: HoldStatus.ACTIVE,
          expiresAt: { gt: new Date() },
        },
      });

      const existingBookings = await tx.booking.findMany({
        where: {
          turfId: dto.turfId,
          bookingDate: targetDate,
          status: {
            in: [
              BookingStatus.CONFIRMED,
              BookingStatus.PENDING,
              BookingStatus.PAYMENT_PENDING,
            ],
          },
        },
      });

      for (const slot of sortedSlots) {
        const conflictingHold = existingHolds.find((h) =>
          this.isSlotOverlappingWithHold(slot.startTime, slot.endTime, h),
        );

        if (conflictingHold) {
          if (conflictingHold.userId === userId && sortedSlots.length === 1) {
            return conflictingHold; // Re-use own active hold if single slot
          }
          if (conflictingHold.userId !== userId) {
            throw new ConflictException(
              `Timeslot ${slot.startTime} - ${slot.endTime} is temporarily held by another customer. Please choose another slot or try again shortly.`,
            );
          }
        }

        const conflictingBooking = existingBookings.find((b) =>
          this.isSlotOverlappingWithBooking(slot.startTime, slot.endTime, b),
        );

        if (conflictingBooking) {
          throw new ConflictException(
            `Timeslot ${slot.startTime} - ${slot.endTime} has already been booked`,
          );
        }
      }

      // 8. Calculate slot prices from availability
      const slotsOverview = await this.availabilityService.getAvailableSlots(
        dto.turfId,
        {
          date: holdDateStr,
          sportId: dto.sportId,
        },
      );

      let totalCalculatedPrice = 0;
      const holdSlots: { startTime: string; endTime: string; price: number; durationMinutes: number }[] = [];

      for (const slot of sortedSlots) {
        const matchedSlot = slotsOverview.slots.find(
          (s) => s.startTime === slot.startTime,
        );
        const slotPrice = slot.price ?? (matchedSlot ? matchedSlot.price : 1000);
        const slotDuration = this.calculateDurationMinutes(
          slot.startTime,
          slot.endTime,
        );

        holdSlots.push({
          startTime: slot.startTime,
          endTime: slot.endTime,
          price: slotPrice,
          durationMinutes: slotDuration,
        });

        totalCalculatedPrice += slotPrice;
      }

      // 9. Calculate advance payment if requested or configured
      const isAdvance = dto.isAdvance || dto.advanceAmount !== undefined;
      const minPercentage = Number(turf.minAdvancePercentage ?? 20);
      const minFixed = Number(turf.minAdvanceAmount ?? 0);
      const calculatedMinAdvance = Math.min(
        totalCalculatedPrice,
        Math.max(
          minFixed,
          Math.round((totalCalculatedPrice * minPercentage) / 100),
        ),
      );

      let holdAdvanceAmount: number | null = null;
      let holdMinAdvanceAmount: number | null = null;

      if (isAdvance) {
        if (!turf.advancePaymentAllowed) {
          throw new BadRequestException(
            'Advance booking is not enabled for this turf venue',
          );
        }
        holdMinAdvanceAmount = calculatedMinAdvance;
        if (dto.advanceAmount !== undefined) {
          if (dto.advanceAmount < calculatedMinAdvance) {
            throw new BadRequestException(
              `Advance payment must be at least ₹${calculatedMinAdvance} (${minPercentage}% of total ₹${totalCalculatedPrice})`,
            );
          }
          if (dto.advanceAmount > totalCalculatedPrice) {
            throw new BadRequestException(
              `Advance payment cannot exceed total price of ₹${totalCalculatedPrice}`,
            );
          }
          holdAdvanceAmount = dto.advanceAmount;
        } else {
          holdAdvanceAmount = calculatedMinAdvance;
        }
      }

      // 10. Create the SlotHold with 10-minute TTL
      const ttlMinutes = 10;
      const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
      const earliestStart = sortedSlots[0].startTime;
      const latestEnd = sortedSlots[sortedSlots.length - 1].endTime;
      const activeHoldKey = `${dto.turfId}_${holdDateStr}_${sortedSlots.map((s) => s.startTime).join('_')}`.slice(0, 120);

      const hold = await tx.slotHold.create({
        data: {
          holdCode: this.generateHoldCode(),
          userId,
          turfId: dto.turfId,
          sportId: dto.sportId ?? null,
          holdDate: targetDate,
          startTime: earliestStart,
          endTime: latestEnd,
          timeSlots: holdSlots,
          expiresAt,
          status: HoldStatus.ACTIVE,
          totalPrice: totalCalculatedPrice,
          isAdvanceHold: isAdvance,
          advanceAmount: holdAdvanceAmount,
          minAdvanceAmount: holdMinAdvanceAmount,
          idempotencyKey: dto.idempotencyKey ?? null,
          activeHoldKey,
        } as any,
      });

      const feeBreakdown = this.calculateFeeBreakdown(totalCalculatedPrice);
      const advanceRemaining = isAdvance
        ? Math.max(0, totalCalculatedPrice - (holdAdvanceAmount || 0))
        : 0;

      return {
        ...hold,
        timeSlots: holdSlots,
        feeBreakdown,
        advancePayment: {
          isAdvanceHold: isAdvance,
          advanceAllowed: Boolean(turf.advancePaymentAllowed),
          advanceAmount: holdAdvanceAmount,
          minAdvanceAmount: holdMinAdvanceAmount ?? calculatedMinAdvance,
          remainingAmount: advanceRemaining,
        },
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
          select: {
            id: true,
            name: true,
            addressLine: true,
            city: true,
            advancePaymentAllowed: true,
            minAdvancePercentage: true,
            minAdvanceAmount: true,
          },
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

    const advanceRemaining = hold.isAdvanceHold
      ? Math.max(0, Number(hold.totalPrice) - Number(hold.advanceAmount || 0))
      : 0;

    const advanceInfo = {
      isAdvanceHold: hold.isAdvanceHold,
      advanceAllowed: Boolean(hold.turf?.advancePaymentAllowed),
      advanceAmount: hold.advanceAmount ? Number(hold.advanceAmount) : null,
      minAdvanceAmount: hold.minAdvanceAmount
        ? Number(hold.minAdvanceAmount)
        : null,
      remainingAmount: advanceRemaining,
    };

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
        advancePayment: advanceInfo,
      };
    }

    return {
      ...hold,
      feeBreakdown: this.calculateFeeBreakdown(Number(hold.totalPrice)),
      advancePayment: advanceInfo,
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

      let bookingSlots: { startTime: string; endTime: string; price: number; durationMinutes: number }[] = [];
      let holdRecord: any = null;

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

        holdRecord = hold;
        turfId = hold.turfId;
        bookingDateStr = this.formatDateIso(hold.holdDate);
        startTime = hold.startTime;
        endTime = hold.endTime;
        sportId = hold.sportId ?? undefined;
        totalPrice = Number(hold.totalPrice);

        const holdTimeSlots = (hold as any).timeSlots;
        if (Array.isArray(holdTimeSlots) && holdTimeSlots.length > 0) {
          bookingSlots = holdTimeSlots as any;
        } else {
          bookingSlots = [
            {
              startTime: hold.startTime,
              endTime: hold.endTime,
              price: Number(hold.totalPrice),
              durationMinutes: this.calculateDurationMinutes(
                hold.startTime,
                hold.endTime,
              ),
            },
          ];
        }

        // Acquire advisory lock on each slot
        for (const slot of bookingSlots) {
          const lockKey = `turf_slot_${turfId}_${bookingDateStr}_${slot.startTime}`;
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
        }

        // Mark hold CONVERTED
        await tx.slotHold.update({
          where: { id: hold.id },
          data: {
            status: HoldStatus.CONVERTED,
            activeHoldKey: null,
          },
        });
      } else {
        // FLOW B: Direct Booking (requires turfId, bookingDate, and startTime/endTime or timeSlots)
        const rawSlots =
          dto.timeSlots && dto.timeSlots.length > 0
            ? dto.timeSlots
            : dto.startTime && dto.endTime
              ? [{ startTime: dto.startTime, endTime: dto.endTime, price: undefined }]
              : [];

        if (!turfId || !bookingDateStr || rawSlots.length === 0) {
          throw new BadRequestException(
            'Either holdId or complete slot details (turfId, bookingDate, and startTime/endTime or timeSlots) must be provided',
          );
        }

        const sortedSlots = [...rawSlots].sort((a, b) =>
          a.startTime.localeCompare(b.startTime),
        );

        startTime = sortedSlots[0].startTime;
        endTime = sortedSlots[sortedSlots.length - 1].endTime;

        // Fetch dynamic pricing
        const slotsOverview = await this.availabilityService.getAvailableSlots(
          turfId,
          {
            date: bookingDateStr,
            sportId,
          },
        );

        const existingHolds = await tx.slotHold.findMany({
          where: {
            turfId,
            holdDate: new Date(bookingDateStr),
            status: HoldStatus.ACTIVE,
            expiresAt: { gt: new Date() },
          },
        });

        totalPrice = 0;
        for (const slot of sortedSlots) {
          // Acquire advisory lock
          const lockKey = `turf_slot_${turfId}_${bookingDateStr}_${slot.startTime}`;
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

          // Check active hold by another customer
          const conflictingHold = existingHolds.find(
            (h) =>
              h.userId !== userId &&
              this.isSlotOverlappingWithHold(slot.startTime, slot.endTime, h),
          );

          if (conflictingHold) {
            throw new ConflictException(
              `Timeslot ${slot.startTime} - ${slot.endTime} is temporarily held by another customer. Please choose another slot.`,
            );
          }

          // Calculate dynamic price & availability
          const matchedSlot = slotsOverview.slots.find(
            (s) => s.startTime === slot.startTime,
          );
          if (matchedSlot && !matchedSlot.isAvailable) {
            throw new ConflictException(
              `Timeslot ${slot.startTime} is not available for booking`,
            );
          }

          const overlappingUnavailable = slotsOverview.slots.some(
            (s) =>
              !s.isAvailable &&
              this.isOverlapping(slot.startTime, slot.endTime, s.startTime, s.endTime),
          );
          if (overlappingUnavailable) {
            throw new ConflictException(
              `Timeslot ${slot.startTime} - ${slot.endTime} is not available for booking`,
            );
          }

          const slotPrice = slot.price ?? (matchedSlot ? matchedSlot.price : 1000);
          const slotDuration = this.calculateDurationMinutes(
            slot.startTime,
            slot.endTime,
          );

          bookingSlots.push({
            startTime: slot.startTime,
            endTime: slot.endTime,
            price: slotPrice,
            durationMinutes: slotDuration,
          });

          totalPrice += slotPrice;
        }
      }

      // Check for duplicate active booking for any of the slots
      const targetDate = new Date(bookingDateStr);
      const existingActiveBookings = await tx.booking.findMany({
        where: {
          turfId: turfId,
          bookingDate: targetDate,
          status: {
            in: [
              BookingStatus.CONFIRMED,
              BookingStatus.PENDING,
              BookingStatus.PAYMENT_PENDING,
            ],
          },
        },
      });

      for (const slot of bookingSlots) {
        const conflictingBooking = existingActiveBookings.find((b) =>
          this.isSlotOverlappingWithBooking(slot.startTime, slot.endTime, b),
        );

        if (conflictingBooking) {
          throw new ConflictException(
            `Slot ${slot.startTime} - ${slot.endTime} has already been booked. Two confirmed bookings cannot share the same turf slot.`,
          );
        }
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

      const totalDurationMinutes = bookingSlots.reduce(
        (sum, s) => sum + (s.durationMinutes || 60),
        0,
      );

      const activeSlotKey = `${turfId}_${bookingDateStr}_${bookingSlots.map((s) => s.startTime).join('_')}`.slice(0, 120);
      const bookingNumber = this.generateBookingNumber();

      const isAdvance = Boolean(
        dto.isAdvanceBooking ||
        dto.advancePaymentAmount !== undefined ||
        holdRecord?.isAdvanceHold,
      );

      let advancePaid = 0;
      let remainingBalance = 0;
      let bookingPaymentStatus = 'PAID';

      if (isAdvance) {
        const turfEntity = await tx.turf.findUnique({
          where: { id: turfId },
          select: {
            advancePaymentAllowed: true,
            minAdvancePercentage: true,
            minAdvanceAmount: true,
          },
        });

        if (!turfEntity?.advancePaymentAllowed) {
          throw new BadRequestException(
            'Advance booking is not allowed for this turf venue',
          );
        }

        const minPct = Number(turfEntity?.minAdvancePercentage ?? 20);
        const minFixed = Number(turfEntity?.minAdvanceAmount ?? 0);
        const minRequired = Math.min(
          feeBreakdown.totalAmount,
          Math.max(
            minFixed,
            Math.round((feeBreakdown.totalAmount * minPct) / 100),
          ),
        );

        if (dto.advancePaymentAmount !== undefined) {
          if (dto.advancePaymentAmount < minRequired) {
            throw new BadRequestException(
              `Advance payment must be at least ₹${minRequired} (${minPct}% of total ₹${feeBreakdown.totalAmount})`,
            );
          }
          if (dto.advancePaymentAmount > feeBreakdown.totalAmount) {
            throw new BadRequestException(
              `Advance payment cannot exceed total amount of ₹${feeBreakdown.totalAmount}`,
            );
          }
          advancePaid = dto.advancePaymentAmount;
        } else if (holdRecord?.advanceAmount) {
          advancePaid = Number(holdRecord.advanceAmount);
        } else if (holdRecord?.minAdvanceAmount) {
          advancePaid = Number(holdRecord.minAdvanceAmount);
        } else {
          advancePaid = minRequired;
        }

        remainingBalance = Math.max(0, feeBreakdown.totalAmount - advancePaid);
        bookingPaymentStatus = remainingBalance <= 0 ? 'PAID' : 'PARTIALLY_PAID';
      } else {
        advancePaid = feeBreakdown.totalAmount;
        remainingBalance = 0;
        bookingPaymentStatus = 'PAID';
      }

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
          durationMinutes: totalDurationMinutes,
          timeSlots: bookingSlots,
          status: BookingStatus.CONFIRMED,
          activeSlotKey,
          idempotencyKey: dto.idempotencyKey ?? null,
          basePrice: feeBreakdown.basePrice,
          taxAmount: feeBreakdown.taxAmount,
          discountAmount: feeBreakdown.discountAmount,
          totalPrice: feeBreakdown.totalAmount,
          isAdvanceBooking: isAdvance,
          advanceAmount: isAdvance ? advancePaid : 0,
          paidAmount: isAdvance ? advancePaid : feeBreakdown.totalAmount,
          remainingAmount: remainingBalance,
          paymentStatus: bookingPaymentStatus,
        } as any,
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
          reason: isAdvance
            ? `Advance booking confirmed with initial payment of ₹${advancePaid}. Remaining balance of ₹${remainingBalance} payable later.`
            : slotHoldId
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
        timeSlots: bookingSlots,
        qrCodeDataUrl,
        paymentMethod: 'UPI',
        paymentStatus: bookingPaymentStatus,
        isAdvanceBooking: isAdvance,
        advanceAmount: isAdvance ? advancePaid : 0,
        paidAmount: isAdvance ? advancePaid : feeBreakdown.totalAmount,
        remainingAmount: remainingBalance,
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
    let basePrice = 0;
    let holdRecord: any = null;
    let quoteSlots: { startTime: string; endTime: string; price: number; durationMinutes: number }[] = [];

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

      if (Array.isArray(hold.timeSlots) && hold.timeSlots.length > 0) {
        quoteSlots = hold.timeSlots as any;
      } else {
        quoteSlots = [
          {
            startTime: hold.startTime,
            endTime: hold.endTime,
            price: Number(hold.totalPrice),
            durationMinutes: this.calculateDurationMinutes(
              hold.startTime,
              hold.endTime,
            ),
          },
        ];
      }
    } else {
      const rawSlots =
        dto.timeSlots && dto.timeSlots.length > 0
          ? dto.timeSlots
          : dto.startTime && dto.endTime
            ? [{ startTime: dto.startTime, endTime: dto.endTime, price: undefined }]
            : [];

      if (!turfId || !targetDateStr || rawSlots.length === 0) {
        throw new BadRequestException(
          'Either holdId or (turfId, date/bookingDate, and startTime/endTime or timeSlots) must be provided',
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

      const sortedSlots = [...rawSlots].sort((a, b) =>
        a.startTime.localeCompare(b.startTime),
      );

      startTime = sortedSlots[0].startTime;
      endTime = sortedSlots[sortedSlots.length - 1].endTime;

      for (const slot of sortedSlots) {
        const matchedSlot = slotsOverview.slots.find(
          (s) => s.startTime === slot.startTime,
        );
        const slotPrice = slot.price ?? (matchedSlot ? matchedSlot.price : 1000);
        const slotDuration = this.calculateDurationMinutes(
          slot.startTime,
          slot.endTime,
        );

        quoteSlots.push({
          startTime: slot.startTime,
          endTime: slot.endTime,
          price: slotPrice,
          durationMinutes: slotDuration,
        });

        basePrice += slotPrice;
      }
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

    const turfEntity =
      holdRecord?.turf?.advancePaymentAllowed !== undefined
        ? holdRecord.turf
        : await this.prisma.turf.findUnique({
            where: { id: turfId },
            select: {
              advancePaymentAllowed: true,
              minAdvancePercentage: true,
              minAdvanceAmount: true,
            },
          });

    const advanceAllowed = turfEntity?.advancePaymentAllowed ?? true;
    const minPercentage = Number(turfEntity?.minAdvancePercentage ?? 20);
    const minFixed = Number(turfEntity?.minAdvanceAmount ?? 0);
    const calculatedMinAdvance = advanceAllowed
      ? Math.min(
          feeBreakdown.totalAmount,
          Math.max(
            minFixed,
            Math.round((feeBreakdown.totalAmount * minPercentage) / 100),
          ),
        )
      : feeBreakdown.totalAmount;
    const remainingBalance = Math.max(
      0,
      feeBreakdown.totalAmount - calculatedMinAdvance,
    );

    const advancePayment = {
      isEligible: advanceAllowed,
      advanceAllowed,
      minAdvancePercentage: minPercentage,
      minAdvanceAmount: minFixed,
      calculatedMinAdvance,
      remainingAmount: remainingBalance,
    };

    return {
      turfId,
      bookingDate: targetDateStr,
      startTime,
      endTime,
      sportId,
      holdId: dto.holdId ?? null,
      holdExpiresAt: holdRecord ? holdRecord.expiresAt : null,
      timeSlots: quoteSlots,
      coupon: couponDetails,
      feeBreakdown,
      advancePayment,
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
          orderBy: { createdAt: 'asc' },
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

    const paymentsList = (booking as any).payments || [];
    const latestPayment = paymentsList.length > 0 ? paymentsList[paymentsList.length - 1] : null;

    return {
      ...booking,
      qrCodeDataUrl,
      paymentMethod: latestPayment?.provider || 'UPI',
      paymentStatus: booking.paymentStatus || latestPayment?.status || 'PAID',
      isAdvanceBooking: Boolean(booking.isAdvanceBooking),
      advanceAmount: Number(booking.advanceAmount || 0),
      paidAmount: Number(booking.paidAmount || 0),
      remainingAmount: Number(booking.remainingAmount || 0),
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

    const rawSlots =
      dto.newTimeSlots && dto.newTimeSlots.length > 0
        ? dto.newTimeSlots
        : dto.newStartTime && dto.newEndTime
          ? [{ startTime: dto.newStartTime, endTime: dto.newEndTime, price: undefined }]
          : [];

    if (rawSlots.length === 0) {
      throw new BadRequestException(
        'Either newStartTime & newEndTime or newTimeSlots must be provided',
      );
    }

    const sortedSlots = [...rawSlots].sort((a, b) =>
      a.startTime.localeCompare(b.startTime),
    );

    const newStartTime = sortedSlots[0].startTime;
    const newEndTime = sortedSlots[sortedSlots.length - 1].endTime;

    return this.prisma.$transaction(async (tx) => {
      // 1. Acquire advisory lock and check conflicts on all new target slots
      const existingHolds = await tx.slotHold.findMany({
        where: {
          turfId: booking.turfId,
          holdDate: newTargetDate,
          status: HoldStatus.ACTIVE,
          expiresAt: { gt: new Date() },
        },
      });

      const existingBookings = await tx.booking.findMany({
        where: {
          turfId: booking.turfId,
          bookingDate: newTargetDate,
          status: {
            in: [
              BookingStatus.CONFIRMED,
              BookingStatus.PENDING,
              BookingStatus.PAYMENT_PENDING,
            ],
          },
        },
      });

      for (const slot of sortedSlots) {
        const newLockKey = `turf_slot_${booking.turfId}_${dto.newDate}_${slot.startTime}`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${newLockKey}))`;

        const conflictingHold = existingHolds.find((h) =>
          this.isSlotOverlappingWithHold(slot.startTime, slot.endTime, h),
        );

        if (conflictingHold) {
          throw new ConflictException(
            `New requested slot ${slot.startTime} - ${slot.endTime} is temporarily held by another customer`,
          );
        }

        const conflictingBooking = existingBookings.find(
          (b) =>
            b.id !== id &&
            this.isSlotOverlappingWithBooking(slot.startTime, slot.endTime, b),
        );

        if (conflictingBooking) {
          throw new ConflictException(
            `New requested slot ${slot.startTime} - ${slot.endTime} is already booked`,
          );
        }
      }

      // 2. Free old slot key and assign new slot key
      const newActiveSlotKey = `${booking.turfId}_${dto.newDate}_${sortedSlots.map((s) => s.startTime).join('_')}`.slice(0, 120);

      const totalDurationMinutes = sortedSlots.reduce(
        (sum, s) =>
          sum + (s.durationMinutes || this.calculateDurationMinutes(s.startTime, s.endTime)),
        0,
      );

      const updated = await tx.booking.update({
        where: { id },
        data: {
          bookingDate: newTargetDate,
          startTime: newStartTime,
          endTime: newEndTime,
          durationMinutes: totalDurationMinutes,
          timeSlots: sortedSlots,
          activeSlotKey: newActiveSlotKey,
        } as any,
      });

      // 3. Record auditable transition
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

  /**
   * PUT/PATCH /api/v1/bookings/:id
   * Edit or update booking details (schedule/slots, sportId, status, notes).
   * Checks authorization, advisory locks new slots, verifies no overlaps, updates booking, and logs history.
   */
  async updateBooking(
    userId: string,
    userRoles: string[],
    id: string,
    dto: UpdateBookingDto,
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
        'You are not authorized to update this booking',
      );
    }

    // Only platform admin or turf owner can change booking status
    if (dto.status !== undefined && dto.status !== booking.status) {
      if (!isPlatformAdmin && !isTurfOwner) {
        throw new ForbiddenException(
          'Only turf owners or platform administrators can update booking status directly',
        );
      }
    }

    const isScheduleChanging =
      dto.bookingDate !== undefined ||
      dto.startTime !== undefined ||
      dto.endTime !== undefined ||
      (dto.timeSlots !== undefined && dto.timeSlots.length > 0);

    const targetDateStr =
      dto.bookingDate || this.formatDateIso(booking.bookingDate);
    const targetDate = new Date(targetDateStr);

    let rawSlots: BookingTimeSlotDto[] = [];
    if (dto.timeSlots && dto.timeSlots.length > 0) {
      rawSlots = dto.timeSlots;
    } else if (dto.startTime && dto.endTime) {
      rawSlots = [
        { startTime: dto.startTime, endTime: dto.endTime, price: undefined },
      ];
    } else if (dto.startTime && !dto.endTime) {
      rawSlots = [
        { startTime: dto.startTime, endTime: booking.endTime, price: undefined },
      ];
    } else if (dto.endTime && !dto.startTime) {
      rawSlots = [
        { startTime: booking.startTime, endTime: dto.endTime, price: undefined },
      ];
    } else if (dto.bookingDate && !dto.startTime && !dto.endTime) {
      if (Array.isArray(booking.timeSlots) && booking.timeSlots.length > 0) {
        rawSlots = booking.timeSlots as any;
      } else {
        rawSlots = [
          { startTime: booking.startTime, endTime: booking.endTime, price: undefined },
        ];
      }
    }

    return this.prisma.$transaction(async (tx) => {
      let updateData: any = {};

      if (dto.sportId !== undefined) {
        updateData.sport = dto.sportId
          ? { connect: { id: dto.sportId } }
          : { disconnect: true };
      }

      if (dto.status !== undefined && dto.status !== booking.status) {
        updateData.status = dto.status;
        if (
          dto.status === BookingStatus.CANCELLED ||
          dto.status === BookingStatus.COMPLETED ||
          dto.status === BookingStatus.NO_SHOW ||
          dto.status === BookingStatus.EXPIRED
        ) {
          updateData.activeSlotKey = null;
        }
      }

      if (isScheduleChanging && rawSlots.length > 0) {
        const sortedSlots = [...rawSlots].sort((a, b) =>
          a.startTime.localeCompare(b.startTime),
        );

        const newStartTime = sortedSlots[0].startTime;
        const newEndTime = sortedSlots[sortedSlots.length - 1].endTime;

        // Advisory locking & range overlap verification on target slots
        const existingHolds = await tx.slotHold.findMany({
          where: {
            turfId: booking.turfId,
            holdDate: targetDate,
            status: HoldStatus.ACTIVE,
            expiresAt: { gt: new Date() },
          },
        });

        const existingBookings = await tx.booking.findMany({
          where: {
            turfId: booking.turfId,
            bookingDate: targetDate,
            status: {
              in: [
                BookingStatus.CONFIRMED,
                BookingStatus.PENDING,
                BookingStatus.PAYMENT_PENDING,
              ],
            },
          },
        });

        for (const slot of sortedSlots) {
          const newLockKey = `turf_slot_${booking.turfId}_${targetDateStr}_${slot.startTime}`;
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${newLockKey}))`;

          const conflictingHold = existingHolds.find((h) =>
            this.isSlotOverlappingWithHold(slot.startTime, slot.endTime, h),
          );

          if (conflictingHold) {
            throw new ConflictException(
              `Requested slot ${slot.startTime} - ${slot.endTime} is temporarily held by another customer`,
            );
          }

          const conflictingBooking = existingBookings.find(
            (b) =>
              b.id !== id &&
              this.isSlotOverlappingWithBooking(slot.startTime, slot.endTime, b),
          );

          if (conflictingBooking) {
            throw new ConflictException(
              `Requested slot ${slot.startTime} - ${slot.endTime} is already booked`,
            );
          }
        }

        const newActiveSlotKey = `${booking.turfId}_${targetDateStr}_${sortedSlots.map((s) => s.startTime).join('_')}`.slice(0, 120);

        const totalDurationMinutes = sortedSlots.reduce(
          (sum, s) =>
            sum +
            (s.durationMinutes ||
              this.calculateDurationMinutes(s.startTime, s.endTime)),
          0,
        );

        updateData = {
          ...updateData,
          bookingDate: targetDate,
          startTime: newStartTime,
          endTime: newEndTime,
          durationMinutes: totalDurationMinutes,
          timeSlots: sortedSlots,
          activeSlotKey:
            updateData.status &&
            (updateData.status === BookingStatus.CANCELLED ||
              updateData.status === BookingStatus.COMPLETED ||
              updateData.status === BookingStatus.NO_SHOW)
              ? null
              : newActiveSlotKey,
        };
      }

      const updated = await tx.booking.update({
        where: { id },
        data: updateData,
        include: {
          turf: true,
          sport: true,
          user: {
            select: { id: true, fullName: true, email: true, phone: true },
          },
        },
      });

      // Status history entry if status or schedule changed
      if (dto.status !== undefined || isScheduleChanging || dto.reason) {
        await tx.bookingStatusHistory.create({
          data: {
            bookingId: id,
            fromStatus: booking.status,
            toStatus: (updateData.status as BookingStatus) || booking.status,
            reason:
              dto.reason ||
              (isScheduleChanging
                ? `Booking schedule updated to ${targetDateStr} ${updated.startTime} - ${updated.endTime}`
                : `Booking updated`),
            changedByUserId: userId,
          },
        });
      }

      return updated;
    });
  }

  /**
   * POST /api/v1/bookings/:id/complete-payment
   * Completes or settles remaining balance payment for an advance booking.
   * If paymentMethod is ONLINE: initiates a payment gateway order via PaymentsService.
   * If paymentMethod is CASH, UPI, CARD: settles balance immediately at venue/counter,
   * creates Payment record with status SUCCESS, zeroes remainingAmount, and updates status history.
   */
  async completePayment(
    userId: string,
    userRoles: string[],
    id: string,
    dto: CompleteBookingPaymentDto,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        turf: { include: { owner: true } },
        payments: { orderBy: { createdAt: 'desc' } },
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
        'You are not authorized to complete payment for this booking',
      );
    }

    if (
      booking.status === BookingStatus.CANCELLED ||
      booking.status === BookingStatus.REFUNDED ||
      booking.status === BookingStatus.EXPIRED
    ) {
      throw new BadRequestException(
        `Cannot complete payment for a booking in "${booking.status}" status`,
      );
    }

    const remainingAmount = Number(booking.remainingAmount);
    if (remainingAmount <= 0 && booking.paymentStatus === 'PAID') {
      throw new BadRequestException(
        'Booking is already fully paid. No remaining balance due.',
      );
    }

    const effectiveRemaining =
      remainingAmount > 0
        ? remainingAmount
        : Math.max(0, Number(booking.totalPrice) - Number(booking.paidAmount));

    const amountToPay = dto.amount
      ? Math.min(dto.amount, effectiveRemaining)
      : effectiveRemaining;

    if (amountToPay <= 0) {
      throw new BadRequestException('Payment amount must be greater than zero');
    }

    // 1. ONLINE payment flow (Razorpay/Stripe/Gateway Order)
    if (!dto.paymentMethod || dto.paymentMethod === PaymentMethodType.ONLINE) {
      if (!this.paymentsService) {
        throw new BadRequestException(
          'Payment gateway service is not available',
        );
      }
      return this.paymentsService.createOrder(userId, {
        bookingId: booking.id,
        amount: amountToPay,
        idempotencyKey: dto.idempotencyKey,
      });
    }

    // 2. Direct / Offline settlement (CASH, UPI, CARD)
    const paymentNumber = `PAY-BAL-${Date.now()}-${randomBytes(3).toString('hex').toUpperCase()}`;
    const orderId = `settle_${Date.now()}_${randomBytes(4).toString('hex')}`;
    const transactionId =
      dto.transactionReference ||
      `TXN-${Date.now()}-${randomBytes(3).toString('hex').toUpperCase()}`;

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          paymentNumber,
          userId: booking.userId,
          bookingId: booking.id,
          provider: dto.paymentMethod || 'OFFLINE',
          orderId,
          transactionId,
          amount: amountToPay,
          currency: 'INR',
          status: PaymentStatus.SUCCESS,
          paymentType: 'BALANCE',
          idempotencyKey: dto.idempotencyKey ?? null,
          metadata: {
            notes: dto.notes || 'Remaining balance settled',
            settledByUserId: userId,
            paymentMethod: dto.paymentMethod,
          },
        },
      });

      await tx.paymentStatusHistory.create({
        data: {
          paymentId: payment.id,
          fromStatus: null,
          toStatus: PaymentStatus.SUCCESS,
          reason: `Balance settled via ${dto.paymentMethod}. Reference: ${transactionId}`,
        },
      });

      const prevPaid = Number(booking.paidAmount || 0);
      const newPaid = prevPaid + amountToPay;
      const newRemaining = Math.max(0, Number(booking.totalPrice) - newPaid);
      const newPaymentStatus = newRemaining <= 0 ? 'PAID' : 'PARTIALLY_PAID';

      const updatedBooking = await tx.booking.update({
        where: { id: booking.id },
        data: {
          paidAmount: newPaid,
          remainingAmount: newRemaining,
          paymentStatus: newPaymentStatus,
        },
        include: {
          turf: {
            select: { id: true, name: true, addressLine: true },
          },
        },
      });

      const isFullySettled = newRemaining <= 0;
      await tx.bookingStatusHistory.create({
        data: {
          bookingId: booking.id,
          fromStatus: booking.status,
          toStatus: booking.status,
          reason: isFullySettled
            ? `Remaining balance of ₹${amountToPay} settled via ${dto.paymentMethod}. Booking is now fully paid.`
            : `Partial balance of ₹${amountToPay} settled via ${dto.paymentMethod}. Remaining due: ₹${newRemaining}.`,
          changedByUserId: userId,
        },
      });

      if (this.notificationsService) {
        this.notificationsService
          .notifyPaymentSuccessful({
            id: payment.id,
            userId: booking.userId,
            amount: amountToPay,
            orderId: payment.orderId,
            bookingId: booking.id,
          })
          .catch((err: any) =>
            this.logger.error(`Notification failed: ${err.message}`),
          );
      }

      return {
        success: true,
        message: isFullySettled
          ? 'Booking payment completed in full!'
          : `Partial balance of ₹${amountToPay} received. Remaining balance: ₹${newRemaining}`,
        payment: {
          id: payment.id,
          paymentNumber: payment.paymentNumber,
          amount: Number(payment.amount),
          paymentMethod: payment.provider,
          status: payment.status,
          transactionId: payment.transactionId,
        },
        booking: {
          id: updatedBooking.id,
          bookingNumber: updatedBooking.bookingNumber,
          totalPrice: Number(updatedBooking.totalPrice),
          paidAmount: Number(updatedBooking.paidAmount),
          remainingAmount: Number(updatedBooking.remainingAmount),
          paymentStatus: updatedBooking.paymentStatus,
          isAdvanceBooking: updatedBooking.isAdvanceBooking,
        },
      };
    });
  }
}
