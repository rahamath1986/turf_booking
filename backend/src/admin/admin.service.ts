import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma, BookingStatus } from '@prisma/client';

// ============================================================================
// QUERY DTOs (inline for admin module)
// ============================================================================

export interface PaginatedQuery {
  page?: number;
  limit?: number;
  search?: string;
}

export interface UserAdminQuery extends PaginatedQuery {
  isActive?: boolean;
  role?: string;
}

export interface OwnerAdminQuery extends PaginatedQuery {
  isVerified?: boolean;
  isActive?: boolean;
}

export interface TurfAdminQuery extends PaginatedQuery {
  isApproved?: boolean;
  isActive?: boolean;
  cityId?: string;
}

export interface BookingAdminQuery extends PaginatedQuery {
  status?: BookingStatus;
  turfId?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
}

export interface ReportQuery {
  startDate?: string;
  endDate?: string;
  groupBy?: 'day' | 'week' | 'month';
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ============================================================================
  // PLATFORM STATS
  // ============================================================================

  async getPlatformStats() {
    const [
      usersCount,
      turfsCount,
      sportsCount,
      citiesCount,
      bookingsCount,
      activeBookings,
      totalRevenue,
      pendingOwners,
      pendingTurfs,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.turf.count({ where: { deletedAt: null } }),
      this.prisma.sport.count({ where: { isActive: true } }),
      this.prisma.city.count({ where: { isActive: true } }),
      this.prisma.booking.count({ where: { deletedAt: null } }),
      this.prisma.booking.count({
        where: { status: BookingStatus.CONFIRMED, deletedAt: null },
      }),
      this.prisma.booking.aggregate({
        where: {
          status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
          deletedAt: null,
        },
        _sum: { totalPrice: true },
      }),
      this.prisma.turfOwner.count({
        where: { isVerified: false, isActive: true, deletedAt: null },
      }),
      this.prisma.turf.count({
        where: { isApproved: false, isActive: true, deletedAt: null },
      }),
    ]);

    return {
      users: usersCount,
      turfs: turfsCount,
      sports: sportsCount,
      cities: citiesCount,
      bookings: { total: bookingsCount, active: activeBookings },
      totalRevenue: Number(totalRevenue._sum.totalPrice ?? 0),
      pendingApprovals: { owners: pendingOwners, turfs: pendingTurfs },
      database: 'turf_booking_db',
    };
  }

  // ============================================================================
  // USER MANAGEMENT
  // ============================================================================

  async listUsers(query: UserAdminQuery) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = { deletedAt: null };

    if (query.isActive !== undefined) where.isActive = query.isActive;

    if (query.search) {
      const q = query.search.trim();
      where.OR = [
        { fullName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (query.role) {
      where.roles = {
        some: { role: { name: query.role } },
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          phone: true,
          fullName: true,
          avatarUrl: true,
          isActive: true,
          isEmailVerified: true,
          isPhoneVerified: true,
          createdAt: true,
          roles: { select: { role: { select: { name: true } } } },
          _count: { select: { bookings: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: items.map((u) => ({
        ...u,
        roles: u.roles.map((r) => r.role.name),
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getUserById(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: {
        roles: { include: { role: true } },
        turfOwner: true,
        _count: {
          select: { bookings: true, reviews: true, favorites: true },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');

    const { passwordHash, ...safe } = user;
    return {
      ...safe,
      roles: user.roles.map((r) => r.role.name),
    };
  }

  async updateUserStatus(userId: string, isActive: boolean, adminId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive },
    });

    this.logger.log(
      `Admin ${adminId} set user ${userId} isActive=${isActive}`,
    );
    return { message: `User ${isActive ? 'activated' : 'deactivated'} successfully` };
  }

  // ============================================================================
  // OWNER MANAGEMENT
  // ============================================================================

  async listOwners(query: OwnerAdminQuery) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.TurfOwnerWhereInput = { deletedAt: null };

    if (query.isVerified !== undefined) where.isVerified = query.isVerified;
    if (query.isActive !== undefined) where.isActive = query.isActive;

    if (query.search) {
      const q = query.search.trim();
      where.OR = [
        { businessName: { contains: q, mode: 'insensitive' } },
        { user: { email: { contains: q, mode: 'insensitive' } } },
        { user: { fullName: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.turfOwner.findMany({
        where,
        include: {
          user: {
            select: { id: true, email: true, fullName: true, phone: true, isActive: true },
          },
          _count: { select: { turfs: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.turfOwner.count({ where }),
    ]);

    return {
      items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getOwnerById(ownerId: string) {
    const owner = await this.prisma.turfOwner.findFirst({
      where: { id: ownerId, deletedAt: null },
      include: {
        user: {
          select: { id: true, email: true, fullName: true, phone: true, isActive: true, isEmailVerified: true },
        },
        turfs: {
          where: { deletedAt: null },
          select: { id: true, name: true, slug: true, isApproved: true, isActive: true },
        },
        commissionConfig: true,
      },
    });

    if (!owner) throw new NotFoundException('Owner not found');
    return owner;
  }

  async approveOwner(ownerId: string, adminId: string) {
    const owner = await this.prisma.turfOwner.findFirst({
      where: { id: ownerId, deletedAt: null },
    });
    if (!owner) throw new NotFoundException('Owner not found');
    if (owner.isVerified) throw new ConflictException('Owner is already verified');

    await this.prisma.turfOwner.update({
      where: { id: ownerId },
      data: { isVerified: true, isActive: true },
    });

    this.logger.log(`Admin ${adminId} approved owner ${ownerId}`);
    return { message: 'Owner approved successfully' };
  }

  async rejectOwner(ownerId: string, reason: string, adminId: string) {
    const owner = await this.prisma.turfOwner.findFirst({
      where: { id: ownerId, deletedAt: null },
    });
    if (!owner) throw new NotFoundException('Owner not found');

    await this.prisma.turfOwner.update({
      where: { id: ownerId },
      data: { isVerified: false, isActive: false },
    });

    this.logger.log(`Admin ${adminId} rejected owner ${ownerId}: ${reason}`);
    return { message: 'Owner rejected' };
  }

  async suspendOwner(ownerId: string, reason: string, adminId: string) {
    const owner = await this.prisma.turfOwner.findFirst({
      where: { id: ownerId, deletedAt: null },
    });
    if (!owner) throw new NotFoundException('Owner not found');

    await this.prisma.turfOwner.update({
      where: { id: ownerId },
      data: { isActive: false },
    });

    this.logger.log(`Admin ${adminId} suspended owner ${ownerId}: ${reason}`);
    return { message: 'Owner suspended' };
  }

  // ============================================================================
  // TURF MANAGEMENT
  // ============================================================================

  async listTurfs(query: TurfAdminQuery) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.TurfWhereInput = { deletedAt: null };

    if (query.isApproved !== undefined) where.isApproved = query.isApproved;
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.cityId) where.cityId = query.cityId;

    if (query.search) {
      const q = query.search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { addressLine: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.turf.findMany({
        where,
        include: {
          owner: {
            select: { id: true, businessName: true, userId: true },
          },
          city: { select: { id: true, name: true } },
          _count: { select: { bookings: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.turf.count({ where }),
    ]);

    return {
      items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getTurfById(turfId: string) {
    const turf = await this.prisma.turf.findFirst({
      where: { id: turfId, deletedAt: null },
      include: {
        owner: { include: { user: { select: { email: true, fullName: true } } } },
        city: true,
        area: true,
        turfSports: { include: { sport: true } },
        turfFacilities: { include: { facility: true } },
        images: true,
        _count: { select: { bookings: true, reviews: true } },
      },
    });

    if (!turf) throw new NotFoundException('Turf not found');
    return turf;
  }

  async approveTurf(turfId: string, adminId: string) {
    const turf = await this.prisma.turf.findFirst({
      where: { id: turfId, deletedAt: null },
    });
    if (!turf) throw new NotFoundException('Turf not found');
    if (turf.isApproved) throw new ConflictException('Turf is already approved');

    await this.prisma.turf.update({
      where: { id: turfId },
      data: { isApproved: true, isActive: true },
    });

    this.logger.log(`Admin ${adminId} approved turf ${turfId}`);
    return { message: 'Turf approved successfully' };
  }

  async rejectTurf(turfId: string, reason: string, adminId: string) {
    const turf = await this.prisma.turf.findFirst({
      where: { id: turfId, deletedAt: null },
    });
    if (!turf) throw new NotFoundException('Turf not found');

    await this.prisma.turf.update({
      where: { id: turfId },
      data: { isApproved: false, isActive: false },
    });

    this.logger.log(`Admin ${adminId} rejected turf ${turfId}: ${reason}`);
    return { message: 'Turf rejected' };
  }

  async suspendTurf(turfId: string, reason: string, adminId: string) {
    const turf = await this.prisma.turf.findFirst({
      where: { id: turfId, deletedAt: null },
    });
    if (!turf) throw new NotFoundException('Turf not found');

    await this.prisma.turf.update({
      where: { id: turfId },
      data: { isActive: false },
    });

    this.logger.log(`Admin ${adminId} suspended turf ${turfId}: ${reason}`);
    return { message: 'Turf suspended' };
  }

  // ============================================================================
  // BOOKING MANAGEMENT (READ-ONLY for admin)
  // ============================================================================

  async listBookings(query: BookingAdminQuery) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.BookingWhereInput = { deletedAt: null };

    if (query.status) where.status = query.status;
    if (query.turfId) where.turfId = query.turfId;
    if (query.userId) where.userId = query.userId;

    if (query.startDate || query.endDate) {
      where.bookingDate = {};
      if (query.startDate) (where.bookingDate as Prisma.DateTimeFilter).gte = new Date(query.startDate);
      if (query.endDate) (where.bookingDate as Prisma.DateTimeFilter).lte = new Date(query.endDate);
    }

    if (query.search) {
      const q = query.search.trim();
      where.OR = [
        { bookingNumber: { contains: q, mode: 'insensitive' } },
        { user: { fullName: { contains: q, mode: 'insensitive' } } },
        { user: { email: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: {
          turf: { select: { id: true, name: true } },
          user: { select: { id: true, fullName: true, email: true, phone: true } },
          sport: { select: { id: true, name: true } },
          payments: { select: { id: true, status: true, amount: true, provider: true } },
          refunds: { select: { id: true, status: true, amount: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.booking.count({ where }),
    ]);

    return {
      items: items.map((b) => ({
        id: b.id,
        bookingNumber: b.bookingNumber,
        turfId: b.turfId,
        turfName: b.turf?.name,
        customer: b.user,
        sport: b.sport?.name,
        bookingDate: b.bookingDate,
        startTime: b.startTime,
        endTime: b.endTime,
        status: b.status,
        totalPrice: Number(b.totalPrice),
        basePrice: Number(b.basePrice),
        taxAmount: Number(b.taxAmount),
        discountAmount: Number(b.discountAmount),
        paymentStatus: b.payments[0]?.status ?? null,
        refundStatus: b.refunds[0]?.status ?? null,
        cancelledAt: b.cancelledAt,
        cancellationReason: b.cancellationReason,
        createdAt: b.createdAt,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getBookingById(bookingId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, deletedAt: null },
      include: {
        turf: { select: { id: true, name: true, addressLine: true } },
        user: { select: { id: true, fullName: true, email: true, phone: true } },
        sport: true,
        payments: {
          include: { statusHistory: { orderBy: { createdAt: 'desc' } } },
          orderBy: { createdAt: 'desc' },
        },
        refunds: true,
        statusHistory: { orderBy: { createdAt: 'asc' } },
        checkInAudits: { orderBy: { performedAt: 'desc' } },
        couponUsages: { include: { coupon: { select: { code: true } } } },
      },
    });

    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  // ============================================================================
  // REPORTING APIS
  // ============================================================================

  private buildDateRange(query: ReportQuery): { gte?: Date; lte?: Date } {
    const range: { gte?: Date; lte?: Date } = {};
    if (query.startDate) range.gte = new Date(query.startDate);
    if (query.endDate) range.lte = new Date(query.endDate);
    return range;
  }

  async getRevenueReport(query: ReportQuery) {
    const dateRange = this.buildDateRange(query);

    const where: Prisma.BookingWhereInput = {
      status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
      deletedAt: null,
    };
    if (dateRange.gte || dateRange.lte) where.bookingDate = dateRange;

    const bookings = await this.prisma.booking.findMany({
      where,
      select: {
        bookingDate: true,
        totalPrice: true,
        discountAmount: true,
        taxAmount: true,
        basePrice: true,
        turfId: true,
        turf: { select: { name: true, owner: { select: { businessName: true } } } },
      },
      orderBy: { bookingDate: 'asc' },
    });

    const groupBy = query.groupBy ?? 'day';
    const grouped: Record<string, { revenue: number; count: number; tax: number; discount: number }> = {};

    for (const b of bookings) {
      const key = this.groupKey(b.bookingDate, groupBy);
      if (!grouped[key]) grouped[key] = { revenue: 0, count: 0, tax: 0, discount: 0 };
      grouped[key].revenue += Number(b.totalPrice);
      grouped[key].count += 1;
      grouped[key].tax += Number(b.taxAmount);
      grouped[key].discount += Number(b.discountAmount);
    }

    const trend = Object.entries(grouped)
      .map(([period, val]) => ({
        period,
        revenue: Math.round(val.revenue * 100) / 100,
        bookingsCount: val.count,
        taxAmount: Math.round(val.tax * 100) / 100,
        discountAmount: Math.round(val.discount * 100) / 100,
      }))
      .sort((a, b) => a.period.localeCompare(b.period));

    const totals = {
      revenue: Math.round(bookings.reduce((s, b) => s + Number(b.totalPrice), 0) * 100) / 100,
      bookingsCount: bookings.length,
      taxAmount: Math.round(bookings.reduce((s, b) => s + Number(b.taxAmount), 0) * 100) / 100,
      discountAmount: Math.round(bookings.reduce((s, b) => s + Number(b.discountAmount), 0) * 100) / 100,
    };

    return { totals, trend };
  }

  async getBookingsReport(query: ReportQuery) {
    const dateRange = this.buildDateRange(query);
    const where: Prisma.BookingWhereInput = { deletedAt: null };
    if (dateRange.gte || dateRange.lte) where.bookingDate = dateRange;

    const bookings = await this.prisma.booking.findMany({
      where,
      select: { bookingDate: true, status: true },
      orderBy: { bookingDate: 'asc' },
    });

    const groupBy = query.groupBy ?? 'day';
    const grouped: Record<string, Record<string, number>> = {};

    for (const b of bookings) {
      const key = this.groupKey(b.bookingDate, groupBy);
      if (!grouped[key]) grouped[key] = {};
      grouped[key][b.status] = (grouped[key][b.status] || 0) + 1;
    }

    const statusCounts: Record<string, number> = {};
    for (const b of bookings) {
      statusCounts[b.status] = (statusCounts[b.status] || 0) + 1;
    }

    const trend = Object.entries(grouped)
      .map(([period, statusMap]) => ({ period, ...statusMap }))
      .sort((a, b) => a.period.localeCompare(b.period));

    return {
      total: bookings.length,
      byStatus: statusCounts,
      trend,
    };
  }

  async getUsersReport(query: ReportQuery) {
    const dateRange = this.buildDateRange(query);
    const where: Prisma.UserWhereInput = { deletedAt: null };
    if (dateRange.gte || dateRange.lte) where.createdAt = dateRange;

    const [totalUsers, newUsers, verifiedUsers, roleBreakdown] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where }),
      this.prisma.user.count({ where: { deletedAt: null, isEmailVerified: true } }),
      this.prisma.userRole.groupBy({
        by: ['roleId'],
        _count: true,
      }),
    ]);

    // Enrich role IDs with names
    const roleIds = roleBreakdown.map((r) => r.roleId);
    const roles = await this.prisma.role.findMany({
      where: { id: { in: roleIds } },
      select: { id: true, name: true },
    });
    const roleNameMap = Object.fromEntries(roles.map((r) => [r.id, r.name]));

    return {
      totalUsers,
      newUsersInPeriod: newUsers,
      verifiedUsers,
      verificationRate: totalUsers > 0 ? Math.round((verifiedUsers / totalUsers) * 1000) / 10 : 0,
      byRole: roleBreakdown.map((r) => ({
        role: roleNameMap[r.roleId] ?? r.roleId,
        count: r._count,
      })),
    };
  }

  async getTurfsReport(query: ReportQuery) {
    const dateRange = this.buildDateRange(query);
    const where: Prisma.TurfWhereInput = { deletedAt: null };
    if (dateRange.gte || dateRange.lte) where.createdAt = dateRange;

    const [total, approved, active, byCity] = await Promise.all([
      this.prisma.turf.count({ where: { deletedAt: null } }),
      this.prisma.turf.count({ where: { deletedAt: null, isApproved: true } }),
      this.prisma.turf.count({ where: { deletedAt: null, isActive: true } }),
      this.prisma.turf.groupBy({
        by: ['cityId'],
        where: { deletedAt: null },
        _count: true,
        orderBy: { _count: { cityId: 'desc' } },
        take: 10,
      }),
    ]);

    const cityIds = byCity.map((c) => c.cityId);
    const cities = await this.prisma.city.findMany({
      where: { id: { in: cityIds } },
      select: { id: true, name: true },
    });
    const cityMap = Object.fromEntries(cities.map((c) => [c.id, c.name]));

    return {
      total,
      approved,
      active,
      approvalRate: total > 0 ? Math.round((approved / total) * 1000) / 10 : 0,
      byCity: byCity.map((c) => ({
        cityId: c.cityId,
        cityName: cityMap[c.cityId] ?? 'Unknown',
        turfCount: c._count,
      })),
    };
  }

  async getCommissionReport(query: ReportQuery) {
    const dateRange = this.buildDateRange(query);
    const where: Prisma.CommissionTransactionWhereInput = {};
    if (dateRange.gte || dateRange.lte) where.createdAt = dateRange;

    const [totals, settled, unsettled] = await Promise.all([
      this.prisma.commissionTransaction.aggregate({
        where,
        _sum: { grossAmount: true, commissionAmount: true, netOwnerEarning: true, refundAmount: true },
        _count: true,
      }),
      this.prisma.commissionTransaction.aggregate({
        where: { ...where, isSettled: true },
        _sum: { commissionAmount: true, netOwnerEarning: true },
        _count: true,
      }),
      this.prisma.commissionTransaction.aggregate({
        where: { ...where, isSettled: false },
        _sum: { commissionAmount: true, netOwnerEarning: true },
        _count: true,
      }),
    ]);

    return {
      totals: {
        transactionCount: totals._count,
        grossAmount: Number(totals._sum.grossAmount ?? 0),
        commissionAmount: Number(totals._sum.commissionAmount ?? 0),
        refundAmount: Number(totals._sum.refundAmount ?? 0),
        netOwnerEarning: Number(totals._sum.netOwnerEarning ?? 0),
      },
      settled: {
        count: settled._count,
        commissionAmount: Number(settled._sum.commissionAmount ?? 0),
        netOwnerEarning: Number(settled._sum.netOwnerEarning ?? 0),
      },
      unsettled: {
        count: unsettled._count,
        commissionAmount: Number(unsettled._sum.commissionAmount ?? 0),
        netOwnerEarning: Number(unsettled._sum.netOwnerEarning ?? 0),
      },
    };
  }

  async getRefundsReport(query: ReportQuery) {
    const dateRange = this.buildDateRange(query);
    const where: Prisma.RefundWhereInput = {};
    if (dateRange.gte || dateRange.lte) where.createdAt = dateRange;

    const [totals, byStatus] = await Promise.all([
      this.prisma.refund.aggregate({
        where,
        _sum: { amount: true, cancellationFee: true },
        _count: true,
      }),
      this.prisma.refund.groupBy({
        by: ['status'],
        where,
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return {
      totalCount: totals._count,
      totalAmount: Number(totals._sum.amount ?? 0),
      totalCancellationFees: Number(totals._sum.cancellationFee ?? 0),
      byStatus: byStatus.map((s) => ({
        status: s.status,
        count: s._count,
        amount: Number(s._sum.amount ?? 0),
      })),
    };
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private groupKey(date: Date, groupBy: 'day' | 'week' | 'month'): string {
    const d = new Date(date);
    if (groupBy === 'month') return d.toISOString().substring(0, 7);
    if (groupBy === 'week') {
      // ISO week start (Monday)
      const day = d.getDay() || 7;
      d.setDate(d.getDate() + 1 - day);
      return d.toISOString().split('T')[0];
    }
    return d.toISOString().split('T')[0];
  }
}
