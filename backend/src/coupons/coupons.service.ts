import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { ValidateCouponDto } from './dto/validate-coupon.dto';
import { CouponQueryDto } from './dto/coupon-query.dto';

@Injectable()
export class CouponsService {
  private readonly logger = new Logger(CouponsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /api/v1/coupons
   * Customer-facing active, valid coupons available for redemption
   */
  async getActiveCoupons(turfId?: string, sportType?: string) {
    const now = new Date();

    const coupons = await this.prisma.coupon.findMany({
      where: {
        isActive: true,
        startDate: { lte: now },
        endDate: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Filter by usage limit, turf, and sport
    const filtered = coupons.filter((coupon) => {
      // Usage limit check
      if (
        coupon.totalUsageLimit !== null &&
        coupon.currentUsageCount >= coupon.totalUsageLimit
      ) {
        return false;
      }

      // Turf filter if turfId is specified in request
      if (
        turfId &&
        coupon.turfIds &&
        coupon.turfIds.length > 0 &&
        !coupon.turfIds.includes(turfId)
      ) {
        return false;
      }

      // Sport filter if sportType is specified in request
      if (
        sportType &&
        coupon.sportTypes &&
        coupon.sportTypes.length > 0 &&
        !coupon.sportTypes
          .map((s) => s.toUpperCase())
          .includes(sportType.toUpperCase())
      ) {
        return false;
      }

      return true;
    });

    return {
      coupons: filtered.map((c) => ({
        id: c.id,
        code: c.code,
        description: c.description,
        discountType: c.discountType,
        discountValue: Number(c.discountValue),
        minOrderAmount: Number(c.minOrderAmount),
        maxDiscountAmount: c.maxDiscountAmount
          ? Number(c.maxDiscountAmount)
          : null,
        endDate: c.endDate,
        isFirstBookingOnly: c.isFirstBookingOnly,
      })),
    };
  }

  /**
   * POST /api/v1/coupons/validate
   * Validates coupon code against all 8 business rules and returns discount calculation
   */
  async validateCoupon(dto: ValidateCouponDto, userId?: string) {
    const code = dto.code.trim().toUpperCase();
    const orderAmount = Number(dto.amount);

    if (isNaN(orderAmount) || orderAmount <= 0) {
      throw new BadRequestException('Order amount must be a positive number');
    }

    const coupon = await this.prisma.coupon.findUnique({
      where: { code },
    });

    const failure = (msg: string) => ({
      valid: false,
      isValid: false,
      message: msg,
      reason: msg,
      discountAmount: 0,
      finalAmount: orderAmount,
    });

    if (!coupon) {
      return failure(`Coupon code '${code}' does not exist`);
    }

    // 1. Active status check
    if (!coupon.isActive) {
      return failure(`Coupon code '${code}' is no longer active`);
    }

    const now = new Date();

    // 2. Expiry / Active period check
    if (now < coupon.startDate) {
      return failure(`Coupon code '${code}' is not active yet`);
    }

    if (now > coupon.endDate) {
      return failure(`Coupon code '${code}' has expired`);
    }

    // 3. Total usage limit check
    if (
      coupon.totalUsageLimit !== null &&
      coupon.currentUsageCount >= coupon.totalUsageLimit
    ) {
      return failure(`Coupon code '${code}' has reached its total usage limit`);
    }

    // 4. Per-user limit check
    if (userId) {
      const userUsageCount = await this.prisma.couponUsage.count({
        where: {
          couponId: coupon.id,
          userId,
        },
      });

      if (userUsageCount >= coupon.perUserLimit) {
        return failure(`You have reached the maximum allowed redemptions (${coupon.perUserLimit}) for this coupon`);
      }
    }

    // 5. First booking only check
    if (coupon.isFirstBookingOnly && userId) {
      const priorConfirmedBookings = await this.prisma.booking.count({
        where: {
          userId,
          status: { in: ['CONFIRMED', 'COMPLETED'] },
        },
      });

      if (priorConfirmedBookings > 0) {
        return failure(`Coupon code '${code}' is exclusively reserved for first-time bookings`);
      }
    }

    // 6. Minimum order amount check
    const minOrder = Number(coupon.minOrderAmount);
    if (orderAmount < minOrder) {
      return failure(`Minimum booking amount of ₹${minOrder} required to apply this coupon`);
    }

    // 7. Turf restriction check
    if (coupon.turfIds && coupon.turfIds.length > 0) {
      if (!dto.turfId || !coupon.turfIds.includes(dto.turfId)) {
        return failure(`This coupon is not valid for the selected turf venue`);
      }
    }

    // 8. Sport restriction check
    if (coupon.sportTypes && coupon.sportTypes.length > 0) {
      if (
        !dto.sportType ||
        !coupon.sportTypes
          .map((s) => s.toUpperCase())
          .includes(dto.sportType.toUpperCase())
      ) {
        return failure(`This coupon is only valid for ${coupon.sportTypes.join(', ')} bookings`);
      }
    }

    // 9. Owner restriction check (owner-wise offers)
    if (coupon.ownerIds && coupon.ownerIds.length > 0) {
      if (!dto.turfId) {
        return failure(`This coupon is restricted to selected turf owners`);
      }
      const venue = await this.prisma.turf.findUnique({
        where: { id: dto.turfId },
        select: { ownerId: true },
      });
      if (!venue || !coupon.ownerIds.includes(venue.ownerId)) {
        return failure(`This coupon is not valid for the selected turf venue`);
      }
    }

    // 10. Day-of-week validity check (e.g. weekend-only offers).
    // Convention: 0=Sunday .. 6=Saturday (same as JS Date.getDay()).
    if (coupon.validDays && coupon.validDays.length > 0) {
      const refDate = dto.bookingDate ? new Date(dto.bookingDate) : now;
      const dayNames = [
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
      ];
      if (!coupon.validDays.includes(refDate.getDay())) {
        const allowed = coupon.validDays
          .slice()
          .sort((a, b) => a - b)
          .map((d) => dayNames[d])
          .join(', ');
        return failure(
          `This coupon is only valid on ${allowed}`,
        );
      }
    }

    // Calculation of discount
    let discount = 0;
    if (coupon.discountType === 'PERCENTAGE') {
      discount = (orderAmount * Number(coupon.discountValue)) / 100;
      if (
        coupon.maxDiscountAmount &&
        discount > Number(coupon.maxDiscountAmount)
      ) {
        discount = Number(coupon.maxDiscountAmount);
      }
    } else {
      // FLAT discount
      discount = Number(coupon.discountValue);
    }

    // Discount cannot exceed original order amount
    discount = Math.min(discount, orderAmount);
    discount = Math.round(discount * 100) / 100;
    const finalAmount = Math.max(
      0,
      Math.round((orderAmount - discount) * 100) / 100,
    );

    return {
      valid: true,
      isValid: true,
      message: 'Coupon applied successfully',
      reason: 'Coupon applied successfully',
      coupon: {
        id: coupon.id,
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: Number(coupon.discountValue),
        minOrderAmount: Number(coupon.minOrderAmount),
        maxDiscountAmount: coupon.maxDiscountAmount
          ? Number(coupon.maxDiscountAmount)
          : null,
      },
      originalAmount: orderAmount,
      discountAmount: discount,
      finalAmount,
    };
  }

  /**
   * Helper to record coupon redemption atomically inside a booking transaction
   */
  async recordUsage(
    couponId: string,
    userId: string,
    bookingId: string,
    discountAmount: number,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx || this.prisma;

    await client.couponUsage.create({
      data: {
        couponId,
        userId,
        bookingId,
        discountAmount,
      },
    });

    await client.coupon.update({
      where: { id: couponId },
      data: {
        currentUsageCount: { increment: 1 },
      },
    });
  }

  // ============================================================================
  // ADMIN OPERATIONS
  // ============================================================================

  /**
   * POST /api/v1/admin/coupons
   * Create a new coupon rule set
   */
  async createCoupon(dto: CreateCouponDto) {
    const code = dto.code.trim().toUpperCase();

    const existing = await this.prisma.coupon.findUnique({
      where: { code },
    });

    if (existing) {
      throw new ConflictException(`Coupon code '${code}' already exists`);
    }

    const coupon = await this.prisma.coupon.create({
      data: {
        code,
        description: dto.description || null,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        minOrderAmount: dto.minOrderAmount ?? 0,
        maxDiscountAmount: dto.maxDiscountAmount ?? null,
        startDate: dto.startDate ? new Date(dto.startDate) : new Date(),
        endDate: new Date(dto.endDate),
        totalUsageLimit: dto.totalUsageLimit ?? null,
        perUserLimit: dto.perUserLimit ?? 1,
        turfIds: dto.turfIds ?? [],
        ownerIds: dto.ownerIds ?? [],
        validDays: dto.validDays ?? [],
        sportTypes: dto.sportTypes
          ? dto.sportTypes.map((s) => s.toUpperCase())
          : [],
        isFirstBookingOnly: dto.isFirstBookingOnly ?? false,
        isActive: dto.isActive ?? true,
      },
    });

    this.logger.log(`Admin created coupon '${coupon.code}' (${coupon.id})`);

    return {
      message: 'Coupon created successfully',
      coupon,
    };
  }

  /**
   * GET /api/v1/admin/coupons
   * List all coupons with usage metrics
   */
  async findAllAdmin(query: CouponQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.CouponWhereInput = {};
    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    const [total, items] = await Promise.all([
      this.prisma.coupon.count({ where }),
      this.prisma.coupon.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { usages: true },
          },
        },
      }),
    ]);

    return {
      items: items.map((c) => ({
        ...c,
        discountValue: Number(c.discountValue),
        minOrderAmount: Number(c.minOrderAmount),
        maxDiscountAmount: c.maxDiscountAmount
          ? Number(c.maxDiscountAmount)
          : null,
        totalRedemptions: c._count.usages,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * GET /api/v1/admin/coupons/:id
   */
  async findOneAdmin(id: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id },
      include: {
        usages: {
          take: 50,
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { id: true, fullName: true, email: true } },
          },
        },
      },
    });

    if (!coupon) {
      throw new NotFoundException(`Coupon with ID '${id}' not found`);
    }

    return {
      coupon: {
        ...coupon,
        discountValue: Number(coupon.discountValue),
        minOrderAmount: Number(coupon.minOrderAmount),
        maxDiscountAmount: coupon.maxDiscountAmount
          ? Number(coupon.maxDiscountAmount)
          : null,
      },
    };
  }

  /**
   * PUT /api/v1/admin/coupons/:id
   */
  async updateCoupon(id: string, dto: UpdateCouponDto) {
    const existing = await this.prisma.coupon.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Coupon with ID '${id}' not found`);
    }

    if (dto.code && dto.code.trim().toUpperCase() !== existing.code) {
      const codeTaken = await this.prisma.coupon.findUnique({
        where: { code: dto.code.trim().toUpperCase() },
      });
      if (codeTaken) {
        throw new ConflictException(
          `Coupon code '${dto.code.trim().toUpperCase()}' is already in use`,
        );
      }
    }

    const updated = await this.prisma.coupon.update({
      where: { id },
      data: {
        ...(dto.code ? { code: dto.code.trim().toUpperCase() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.discountType ? { discountType: dto.discountType } : {}),
        ...(dto.discountValue !== undefined
          ? { discountValue: dto.discountValue }
          : {}),
        ...(dto.minOrderAmount !== undefined
          ? { minOrderAmount: dto.minOrderAmount }
          : {}),
        ...(dto.maxDiscountAmount !== undefined
          ? { maxDiscountAmount: dto.maxDiscountAmount }
          : {}),
        ...(dto.startDate ? { startDate: new Date(dto.startDate) } : {}),
        ...(dto.endDate ? { endDate: new Date(dto.endDate) } : {}),
        ...(dto.totalUsageLimit !== undefined
          ? { totalUsageLimit: dto.totalUsageLimit }
          : {}),
        ...(dto.perUserLimit !== undefined
          ? { perUserLimit: dto.perUserLimit }
          : {}),
        ...(dto.turfIds !== undefined ? { turfIds: dto.turfIds } : {}),
        ...(dto.ownerIds !== undefined ? { ownerIds: dto.ownerIds } : {}),
        ...(dto.validDays !== undefined ? { validDays: dto.validDays } : {}),
        ...(dto.sportTypes !== undefined
          ? { sportTypes: dto.sportTypes.map((s) => s.toUpperCase()) }
          : {}),
        ...(dto.isFirstBookingOnly !== undefined
          ? { isFirstBookingOnly: dto.isFirstBookingOnly }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });

    this.logger.log(`Admin updated coupon '${updated.code}' (${id})`);

    return {
      message: 'Coupon updated successfully',
      coupon: updated,
    };
  }

  /**
   * DELETE /api/v1/admin/coupons/:id
   */
  async deleteCoupon(id: string) {
    const existing = await this.prisma.coupon.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Coupon with ID '${id}' not found`);
    }

    await this.prisma.coupon.delete({
      where: { id },
    });

    this.logger.log(`Admin deleted coupon '${existing.code}' (${id})`);

    return {
      message: 'Coupon deleted successfully',
    };
  }
}
