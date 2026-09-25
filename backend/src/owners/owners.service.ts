import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { OwnerBookingQueryDto } from './dto/owner-booking-query.dto';
import { CreateWalkInBookingDto } from './dto/create-walk-in-booking.dto';
import { OwnerCancelBookingDto } from './dto/owner-cancel-booking.dto';
import { OwnerRescheduleBookingDto } from './dto/owner-reschedule-booking.dto';

@Injectable()
export class OwnersService {
  private readonly logger = new Logger(OwnersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getRegisteredOwnersCount() {
    const count = await this.prisma.turfOwner.count({
      where: { deletedAt: null },
    });
    return { registeredOwnersCount: count };
  }

  // ============================================================================
  // AUTHORIZATION & RESOLUTION HELPERS
  // ============================================================================

  /**
   * Resolve all turf IDs owned by the current user.
   * Administrators and SuperAdmins have platform-wide access.
   */
  async getOwnerTurfIds(
    userId: string,
    userRoles: string[] = [],
  ): Promise<string[]> {
    const isAdmin =
      userRoles.includes('ADMIN') || userRoles.includes('SUPER_ADMIN');

    if (isAdmin) {
      const allTurfs = await this.prisma.turf.findMany({
        where: { deletedAt: null },
        select: { id: true },
      });
      return allTurfs.map((t) => t.id);
    }

    const ownerProfile = await this.prisma.turfOwner.findUnique({
      where: { userId },
    });

    if (!ownerProfile) {
      return [];
    }

    const turfs = await this.prisma.turf.findMany({
      where: {
        ownerId: ownerProfile.id,
        deletedAt: null,
      },
      select: { id: true },
    });

    return turfs.map((t) => t.id);
  }

  /**
   * Asserts that a user has ownership permissions for a specific turf
   */
  async assertTurfOwnership(
    turfId: string,
    userId: string,
    userRoles: string[] = [],
  ) {
    const isAdmin =
      userRoles.includes('ADMIN') || userRoles.includes('SUPER_ADMIN');
    if (isAdmin) {
      return;
    }

    const turf = await this.prisma.turf.findFirst({
      where: { id: turfId, deletedAt: null },
      include: { owner: true },
    });

    if (!turf) {
      throw new NotFoundException(`Turf venue with ID '${turfId}' not found`);
    }

    if (turf.owner?.userId !== userId) {
      this.logger.warn(
        `Security alert: User ${userId} unauthorized for turf ${turfId}`,
      );
      throw new ForbiddenException(
        'Access denied: You do not own this turf venue',
      );
    }
  }

  // ============================================================================
  // DASHBOARD & ANALYTICS APIS
  // ============================================================================

  /**
   * GET /api/v1/owner/dashboard
   * High-level executive KPI overview
   */
  async getDashboardSummary(userId: string, userRoles: string[] = []) {
    const turfIds = await this.getOwnerTurfIds(userId, userRoles);

    if (turfIds.length === 0) {
      return {
        today: { revenue: 0, bookingsCount: 0 },
        thisMonth: { revenue: 0, bookingsCount: 0 },
        allTime: {
          revenue: 0,
          bookingsCount: 0,
          completedCount: 0,
          cancelledCount: 0,
        },
        activeTurfsCount: 0,
        averageOccupancyRate: 0,
        cancellationRate: 0,
        topSport: 'None',
        busiestSlot: 'N/A',
        recentBookings: [],
      };
    }

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Fetch all bookings for owner's turfs
    const [allBookings, recentBookings, activeTurfsCount] = await Promise.all([
      this.prisma.booking.findMany({
        where: {
          turfId: { in: turfIds },
          deletedAt: null,
        },
        select: {
          id: true,
          bookingDate: true,
          startTime: true,
          status: true,
          totalPrice: true,
          sport: { select: { name: true } },
        },
      }),
      this.prisma.booking.findMany({
        where: {
          turfId: { in: turfIds },
          deletedAt: null,
        },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          turf: { select: { id: true, name: true } },
          user: { select: { id: true, fullName: true, phone: true } },
          sport: { select: { id: true, name: true } },
        },
      }),
      this.prisma.turf.count({
        where: { id: { in: turfIds }, isActive: true, deletedAt: null },
      }),
    ]);

    let todayRevenue = 0;
    let todayBookings = 0;
    let monthRevenue = 0;
    let monthBookings = 0;
    let allTimeRevenue = 0;
    let completedCount = 0;
    let cancelledCount = 0;

    const sportCounts: Record<string, number> = {};
    const slotCounts: Record<string, number> = {};

    for (const b of allBookings) {
      const price = Number(b.totalPrice);
      const isConfirmedOrCompleted =
        b.status === BookingStatus.CONFIRMED ||
        b.status === BookingStatus.COMPLETED;

      if (b.status === BookingStatus.COMPLETED) completedCount++;
      if (b.status === BookingStatus.CANCELLED) cancelledCount++;

      if (isConfirmedOrCompleted) {
        allTimeRevenue += price;

        // Today check
        const bDateStr = b.bookingDate.toISOString().split('T')[0];
        if (bDateStr === todayStr) {
          todayRevenue += price;
          todayBookings++;
        }

        // Month check
        if (b.bookingDate >= firstDayOfMonth && b.bookingDate <= now) {
          monthRevenue += price;
          monthBookings++;
        }

        // Popular sport tracking
        if (b.sport?.name) {
          sportCounts[b.sport.name] = (sportCounts[b.sport.name] || 0) + 1;
        }

        // Busiest slot tracking
        if (b.startTime) {
          slotCounts[b.startTime] = (slotCounts[b.startTime] || 0) + 1;
        }
      }
    }

    const totalBookingsCount = allBookings.length;
    const cancellationRate =
      totalBookingsCount > 0
        ? Math.round((cancelledCount / totalBookingsCount) * 1000) / 10
        : 0;

    // Top sport
    let topSport = 'None';
    let maxSportCount = 0;
    for (const [sport, count] of Object.entries(sportCounts)) {
      if (count > maxSportCount) {
        maxSportCount = count;
        topSport = sport;
      }
    }

    // Busiest slot
    let busiestSlot = 'N/A';
    let maxSlotCount = 0;
    for (const [slot, count] of Object.entries(slotCounts)) {
      if (count > maxSlotCount) {
        maxSlotCount = count;
        busiestSlot = slot;
      }
    }

    // Estimate average occupancy across past 14 days (16 slots/day)
    const totalSlotsPast14Days = 14 * 16 * turfIds.length;
    const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000);
    const confirmedRecentSlots = allBookings.filter(
      (b) =>
        (b.status === BookingStatus.CONFIRMED ||
          b.status === BookingStatus.COMPLETED) &&
        b.bookingDate >= fourteenDaysAgo,
    ).length;

    const averageOccupancyRate =
      totalSlotsPast14Days > 0
        ? Math.min(
            100,
            Math.round((confirmedRecentSlots / totalSlotsPast14Days) * 1000) /
              10,
          )
        : 0;

    return {
      today: {
        revenue: Math.round(todayRevenue * 100) / 100,
        bookingsCount: todayBookings,
      },
      thisMonth: {
        revenue: Math.round(monthRevenue * 100) / 100,
        bookingsCount: monthBookings,
      },
      allTime: {
        revenue: Math.round(allTimeRevenue * 100) / 100,
        bookingsCount: totalBookingsCount,
        completedCount,
        cancelledCount,
      },
      activeTurfsCount,
      averageOccupancyRate,
      cancellationRate,
      topSport,
      busiestSlot,
      recentBookings: recentBookings.map((b) => ({
        id: b.id,
        bookingNumber: b.bookingNumber,
        turfName: b.turf?.name,
        customerName: b.user?.fullName,
        customerPhone: b.user?.phone,
        sportName: b.sport?.name,
        bookingDate: b.bookingDate,
        startTime: b.startTime,
        endTime: b.endTime,
        status: b.status,
        totalPrice: Number(b.totalPrice),
        createdAt: b.createdAt,
      })),
    };
  }

  /**
   * GET /api/v1/owner/dashboard/revenue
   * Daily and monthly revenue aggregations
   */
  async getRevenueAnalytics(
    userId: string,
    userRoles: string[] = [],
    query: AnalyticsQueryDto,
  ) {
    const turfIds = await this.getOwnerTurfIds(userId, userRoles);

    if (query.turfId) {
      await this.assertTurfOwnership(query.turfId, userId, userRoles);
    }

    const targetTurfIds = query.turfId ? [query.turfId] : turfIds;

    if (targetTurfIds.length === 0) {
      return {
        totalRevenue: 0,
        dailyRevenue: [],
        monthlyRevenue: [],
        turfBreakdown: [],
      };
    }

    const where: Prisma.BookingWhereInput = {
      turfId: { in: targetTurfIds },
      status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
      deletedAt: null,
    };

    if (query.startDate || query.endDate) {
      where.bookingDate = {};
      if (query.startDate) where.bookingDate.gte = new Date(query.startDate);
      if (query.endDate) where.bookingDate.lte = new Date(query.endDate);
    }

    const [bookings, turfs] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        select: {
          turfId: true,
          bookingDate: true,
          totalPrice: true,
        },
        orderBy: { bookingDate: 'asc' },
      }),
      this.prisma.turf.findMany({
        where: { id: { in: targetTurfIds } },
        select: { id: true, name: true },
      }),
    ]);

    const dailyMap: Record<string, { revenue: number; count: number }> = {};
    const monthlyMap: Record<string, { revenue: number; count: number }> = {};
    const turfMap: Record<
      string,
      { revenue: number; count: number; name: string }
    > = {};

    for (const t of turfs) {
      turfMap[t.id] = { revenue: 0, count: 0, name: t.name };
    }

    let totalRevenue = 0;

    for (const b of bookings) {
      const price = Number(b.totalPrice);
      totalRevenue += price;

      const dateStr = b.bookingDate.toISOString().split('T')[0];
      const monthStr = dateStr.substring(0, 7);

      // Daily aggregation
      if (!dailyMap[dateStr]) dailyMap[dateStr] = { revenue: 0, count: 0 };
      dailyMap[dateStr].revenue += price;
      dailyMap[dateStr].count += 1;

      // Monthly aggregation
      if (!monthlyMap[monthStr])
        monthlyMap[monthStr] = { revenue: 0, count: 0 };
      monthlyMap[monthStr].revenue += price;
      monthlyMap[monthStr].count += 1;

      // Turf breakdown
      if (turfMap[b.turfId]) {
        turfMap[b.turfId].revenue += price;
        turfMap[b.turfId].count += 1;
      }
    }

    const dailyRevenue = Object.entries(dailyMap).map(([date, val]) => ({
      date,
      revenue: Math.round(val.revenue * 100) / 100,
      bookingsCount: val.count,
    }));

    const monthlyRevenue = Object.entries(monthlyMap).map(([month, val]) => ({
      month,
      revenue: Math.round(val.revenue * 100) / 100,
      bookingsCount: val.count,
    }));

    const turfBreakdown = Object.entries(turfMap).map(([turfId, val]) => ({
      turfId,
      turfName: val.name,
      totalRevenue: Math.round(val.revenue * 100) / 100,
      bookingsCount: val.count,
    }));

    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      dailyRevenue,
      monthlyRevenue,
      turfBreakdown,
    };
  }

  /**
   * GET /api/v1/owner/dashboard/bookings
   * Booking counts, status breakdown, and trends
   */
  async getBookingsAnalytics(
    userId: string,
    userRoles: string[] = [],
    query: AnalyticsQueryDto,
  ) {
    const turfIds = await this.getOwnerTurfIds(userId, userRoles);

    if (query.turfId) {
      await this.assertTurfOwnership(query.turfId, userId, userRoles);
    }

    const targetTurfIds = query.turfId ? [query.turfId] : turfIds;

    if (targetTurfIds.length === 0) {
      return {
        totalBookings: 0,
        byStatus: {},
        cancellationRate: 0,
        dailyTrend: [],
        byTurf: [],
      };
    }

    const where: Prisma.BookingWhereInput = {
      turfId: { in: targetTurfIds },
      deletedAt: null,
    };

    if (query.startDate || query.endDate) {
      where.bookingDate = {};
      if (query.startDate) where.bookingDate.gte = new Date(query.startDate);
      if (query.endDate) where.bookingDate.lte = new Date(query.endDate);
    }

    const [bookings, turfs] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        select: {
          turfId: true,
          bookingDate: true,
          status: true,
        },
        orderBy: { bookingDate: 'asc' },
      }),
      this.prisma.turf.findMany({
        where: { id: { in: targetTurfIds } },
        select: { id: true, name: true },
      }),
    ]);

    const byStatus: Record<string, number> = {};
    const dailyMap: Record<
      string,
      { total: number; confirmed: number; cancelled: number }
    > = {};
    const turfMap: Record<
      string,
      { name: string; total: number; confirmed: number; cancelled: number }
    > = {};

    for (const t of turfs) {
      turfMap[t.id] = { name: t.name, total: 0, confirmed: 0, cancelled: 0 };
    }

    let cancelledCount = 0;

    for (const b of bookings) {
      byStatus[b.status] = (byStatus[b.status] || 0) + 1;
      const isCancelled = b.status === BookingStatus.CANCELLED;
      const isConfirmed =
        b.status === BookingStatus.CONFIRMED ||
        b.status === BookingStatus.COMPLETED;

      if (isCancelled) cancelledCount++;

      const dateStr = b.bookingDate.toISOString().split('T')[0];
      if (!dailyMap[dateStr]) {
        dailyMap[dateStr] = { total: 0, confirmed: 0, cancelled: 0 };
      }
      dailyMap[dateStr].total++;
      if (isConfirmed) dailyMap[dateStr].confirmed++;
      if (isCancelled) dailyMap[dateStr].cancelled++;

      if (turfMap[b.turfId]) {
        turfMap[b.turfId].total++;
        if (isConfirmed) turfMap[b.turfId].confirmed++;
        if (isCancelled) turfMap[b.turfId].cancelled++;
      }
    }

    const totalBookings = bookings.length;
    const cancellationRate =
      totalBookings > 0
        ? Math.round((cancelledCount / totalBookings) * 1000) / 10
        : 0;

    const dailyTrend = Object.entries(dailyMap).map(([date, val]) => ({
      date,
      total: val.total,
      confirmed: val.confirmed,
      cancelled: val.cancelled,
    }));

    const byTurf = Object.entries(turfMap).map(([turfId, val]) => ({
      turfId,
      turfName: val.name,
      total: val.total,
      confirmed: val.confirmed,
      cancelled: val.cancelled,
    }));

    return {
      totalBookings,
      byStatus,
      cancellationRate,
      dailyTrend,
      byTurf,
    };
  }

  /**
   * GET /api/v1/owner/dashboard/occupancy
   * Slot utilization and occupancy rates
   */
  async getOccupancyAnalytics(
    userId: string,
    userRoles: string[] = [],
    query: AnalyticsQueryDto,
  ) {
    const turfIds = await this.getOwnerTurfIds(userId, userRoles);

    if (query.turfId) {
      await this.assertTurfOwnership(query.turfId, userId, userRoles);
    }

    const targetTurfIds = query.turfId ? [query.turfId] : turfIds;

    if (targetTurfIds.length === 0) {
      return {
        overallOccupancyRate: 0,
        turfOccupancies: [],
        dailyOccupancy: [],
      };
    }

    // Determine analysis window (default 14 days)
    const startDate = query.startDate
      ? new Date(query.startDate)
      : new Date(Date.now() - 14 * 86400000);
    const endDate = query.endDate ? new Date(query.endDate) : new Date();

    const diffDays = Math.max(
      1,
      Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      ),
    );

    const [bookings, turfs] = await Promise.all([
      this.prisma.booking.findMany({
        where: {
          turfId: { in: targetTurfIds },
          bookingDate: { gte: startDate, lte: endDate },
          status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
          deletedAt: null,
        },
        select: { turfId: true, bookingDate: true },
      }),
      this.prisma.turf.findMany({
        where: { id: { in: targetTurfIds } },
        select: { id: true, name: true },
      }),
    ]);

    const SLOTS_PER_DAY = 16; // 06:00 to 22:00 operating window
    const totalSlotsAvailable = diffDays * SLOTS_PER_DAY * targetTurfIds.length;
    const bookedSlotsCount = bookings.length;

    const overallOccupancyRate =
      totalSlotsAvailable > 0
        ? Math.min(
            100,
            Math.round((bookedSlotsCount / totalSlotsAvailable) * 1000) / 10,
          )
        : 0;

    // By turf occupancy
    const turfBookedCounts: Record<string, number> = {};
    for (const b of bookings) {
      turfBookedCounts[b.turfId] = (turfBookedCounts[b.turfId] || 0) + 1;
    }

    const turfOccupancies = turfs.map((t) => {
      const booked = turfBookedCounts[t.id] || 0;
      const capacity = diffDays * SLOTS_PER_DAY;
      const rate =
        capacity > 0
          ? Math.min(100, Math.round((booked / capacity) * 1000) / 10)
          : 0;
      return {
        turfId: t.id,
        turfName: t.name,
        totalSlotsAvailable: capacity,
        bookedSlotsCount: booked,
        occupancyRate: rate,
      };
    });

    // Daily occupancy trend
    const dailyMap: Record<string, number> = {};
    for (const b of bookings) {
      const dateStr = b.bookingDate.toISOString().split('T')[0];
      dailyMap[dateStr] = (dailyMap[dateStr] || 0) + 1;
    }

    const dailyCapacity = SLOTS_PER_DAY * targetTurfIds.length;
    const dailyOccupancy = Object.entries(dailyMap).map(([date, booked]) => ({
      date,
      bookedSlots: booked,
      totalSlotsAvailable: dailyCapacity,
      occupancyRate:
        dailyCapacity > 0
          ? Math.min(100, Math.round((booked / dailyCapacity) * 1000) / 10)
          : 0,
    }));

    return {
      overallOccupancyRate,
      turfOccupancies,
      dailyOccupancy,
    };
  }

  /**
   * GET /api/v1/owner/dashboard/peak-hours
   * Time slot frequencies, popular time slots, and sport distributions
   */
  async getPeakHoursAnalytics(
    userId: string,
    userRoles: string[] = [],
    query: AnalyticsQueryDto,
  ) {
    const turfIds = await this.getOwnerTurfIds(userId, userRoles);

    if (query.turfId) {
      await this.assertTurfOwnership(query.turfId, userId, userRoles);
    }

    const targetTurfIds = query.turfId ? [query.turfId] : turfIds;

    if (targetTurfIds.length === 0) {
      return {
        slotFrequencies: [],
        popularSlots: [],
        popularSports: [],
        periodBreakdown: { morning: 0, afternoon: 0, evening: 0, night: 0 },
      };
    }

    const bookings = await this.prisma.booking.findMany({
      where: {
        turfId: { in: targetTurfIds },
        status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
        deletedAt: null,
      },
      select: {
        startTime: true,
        totalPrice: true,
        sport: { select: { name: true } },
      },
    });

    const hourMap: Record<string, { count: number; revenue: number }> = {};
    const sportMap: Record<string, number> = {};

    const periods = { morning: 0, afternoon: 0, evening: 0, night: 0 };

    for (const b of bookings) {
      const slot = b.startTime || '00:00';
      const hour = parseInt(slot.split(':')[0], 10);
      const price = Number(b.totalPrice);

      if (!hourMap[slot]) hourMap[slot] = { count: 0, revenue: 0 };
      hourMap[slot].count += 1;
      hourMap[slot].revenue += price;

      // Period categorization
      if (hour >= 6 && hour < 12) periods.morning++;
      else if (hour >= 12 && hour < 16) periods.afternoon++;
      else if (hour >= 16 && hour < 20) periods.evening++;
      else periods.night++;

      // Sport distribution
      const sportName = b.sport?.name || 'General';
      sportMap[sportName] = (sportMap[sportName] || 0) + 1;
    }

    // Sort slot frequencies
    const slotFrequencies = Object.entries(hourMap)
      .map(([timeSlot, val]) => ({
        timeSlot,
        count: val.count,
        revenue: Math.round(val.revenue * 100) / 100,
      }))
      .sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));

    // Top 5 popular slots
    const popularSlots = [...slotFrequencies]
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((s) => s.timeSlot);

    // Popular sports breakdown
    const totalSportsBookings = bookings.length;
    const popularSports = Object.entries(sportMap)
      .map(([sportName, count]) => ({
        sportName,
        count,
        percentage:
          totalSportsBookings > 0
            ? Math.round((count / totalSportsBookings) * 1000) / 10
            : 0,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      slotFrequencies,
      popularSlots,
      popularSports,
      periodBreakdown: periods,
    };
  }

  // ============================================================================
  // OWNER BOOKINGS MANAGEMENT
  // ============================================================================

  /**
   * GET /api/v1/owner/bookings
   * Paginated list of bookings across owned turfs with filters
   */
  async getOwnerBookings(
    userId: string,
    userRoles: string[] = [],
    query: OwnerBookingQueryDto,
  ) {
    const turfIds = await this.getOwnerTurfIds(userId, userRoles);

    if (query.turfId) {
      await this.assertTurfOwnership(query.turfId, userId, userRoles);
    }

    const targetTurfIds = query.turfId ? [query.turfId] : turfIds;

    if (targetTurfIds.length === 0) {
      return {
        items: [],
        meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
      };
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.BookingWhereInput = {
      turfId: { in: targetTurfIds },
      deletedAt: null,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.startDate || query.endDate) {
      where.bookingDate = {};
      if (query.startDate) where.bookingDate.gte = new Date(query.startDate);
      if (query.endDate) where.bookingDate.lte = new Date(query.endDate);
    }

    if (query.search) {
      const q = query.search.trim();
      where.OR = [
        { bookingNumber: { contains: q, mode: 'insensitive' } },
        { user: { fullName: { contains: q, mode: 'insensitive' } } },
        { user: { phone: { contains: q, mode: 'insensitive' } } },
        { user: { email: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [total, bookings] = await Promise.all([
      this.prisma.booking.count({ where }),
      this.prisma.booking.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ bookingDate: 'desc' }, { startTime: 'desc' }],
        include: {
          turf: { select: { id: true, name: true } },
          user: {
            select: { id: true, fullName: true, phone: true, email: true },
          },
          sport: { select: { id: true, name: true } },
          payments: {
            select: {
              id: true,
              provider: true,
              status: true,
              amount: true,
            },
          },
        },
      }),
    ]);

    return {
      items: bookings.map((b) => ({
        id: b.id,
        bookingNumber: b.bookingNumber,
        turfId: b.turfId,
        turfName: b.turf?.name,
        customer: {
          id: b.user.id,
          name: b.user.fullName,
          phone: b.user.phone,
          email: b.user.email,
        },
        sportName: b.sport?.name,
        bookingDate: b.bookingDate,
        startTime: b.startTime,
        endTime: b.endTime,
        durationMinutes: b.durationMinutes,
        status: b.status,
        totalPrice: Number(b.totalPrice),
        paymentStatus: b.payments[0]?.status || 'PENDING',
        paymentMethod: b.payments[0]?.provider || 'UNKNOWN',
        createdAt: b.createdAt,
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
   * GET /api/v1/owner/bookings/:id
   * Detailed booking view for owner
   */
  async getOwnerBookingById(
    bookingId: string,
    userId: string,
    userRoles: string[] = [],
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        turf: { include: { owner: true } },
        user: {
          select: { id: true, fullName: true, email: true, phone: true },
        },
        sport: { select: { id: true, name: true, slug: true } },
        payments: {
          orderBy: { createdAt: 'desc' },
          include: { statusHistory: { orderBy: { createdAt: 'desc' } } },
        },
        statusHistory: { orderBy: { createdAt: 'desc' } },
        refunds: true,
      },
    });

    if (!booking) {
      throw new NotFoundException(`Booking with ID '${bookingId}' not found`);
    }

    const isAdmin =
      userRoles.includes('ADMIN') || userRoles.includes('SUPER_ADMIN');
    if (booking.turf.owner?.userId !== userId && !isAdmin) {
      throw new ForbiddenException(
        'Access denied: You do not own this turf venue',
      );
    }

    return {
      booking: {
        ...booking,
        basePrice: Number(booking.basePrice),
        taxAmount: Number(booking.taxAmount),
        discountAmount: Number(booking.discountAmount),
        totalPrice: Number(booking.totalPrice),
      },
    };
  }

  /**
   * POST /api/v1/owner/bookings/walk-in
   * Owner registers an offline or walk-in booking on the spot
   */
  async createWalkInBooking(
    userId: string,
    userRoles: string[] = [],
    dto: CreateWalkInBookingDto,
  ) {
    await this.assertTurfOwnership(dto.turfId, userId, userRoles);

    const bookingDateStr = dto.bookingDate;
    const bookingDate = new Date(bookingDateStr);
    const activeSlotKey = `${dto.turfId}_${bookingDateStr}_${dto.startTime}`;

    // 1. Double booking check via activeSlotKey
    const conflict = await this.prisma.booking.findUnique({
      where: { activeSlotKey },
    });

    if (conflict) {
      throw new ConflictException(
        `Slot ${dto.startTime}-${dto.endTime} on ${bookingDateStr} is already booked`,
      );
    }

    // 2. Check if slot is blocked by owner
    const blocked = await this.prisma.blockedSlot.findFirst({
      where: {
        turfId: dto.turfId,
        blockDate: bookingDate,
        startTime: dto.startTime,
      },
    });

    if (blocked) {
      throw new ConflictException(
        `Slot is currently blocked for maintenance or tournament (${blocked.reason || 'Blocked'})`,
      );
    }

    // 3. Resolve or create customer shadow account for walk-in guest
    let customerUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { phone: dto.customerPhone },
          ...(dto.customerEmail ? [{ email: dto.customerEmail }] : []),
        ],
      },
    });

    if (!customerUser) {
      const sanitizedPhone = dto.customerPhone.replace(/[^0-9]/g, '');
      const walkInEmail =
        dto.customerEmail ||
        `walkin.${sanitizedPhone || Date.now()}@turfplatform.guest`;

      customerUser = await this.prisma.user.create({
        data: {
          fullName: dto.customerName,
          email: walkInEmail,
          phone: dto.customerPhone,
          passwordHash: 'WALK_IN_GUEST_NO_AUTH',
          isActive: true,
        },
      });
    }

    // 4. Calculate price
    const finalPrice = dto.price !== undefined ? Number(dto.price) : 1000;

    // 5. Atomic Booking Creation
    const booking = await this.prisma.$transaction(async (tx) => {
      const created = await tx.booking.create({
        data: {
          bookingNumber: `WLK-${Date.now().toString(36).toUpperCase()}`,
          userId: customerUser.id,
          turfId: dto.turfId,
          sportId: dto.sportId || null,
          bookingDate,
          startTime: dto.startTime,
          endTime: dto.endTime,
          status: BookingStatus.CONFIRMED,
          activeSlotKey,
          basePrice: finalPrice,
          totalPrice: finalPrice,
        },
        include: {
          turf: { select: { id: true, name: true } },
          sport: { select: { id: true, name: true } },
        },
      });

      // Audit status history
      await tx.bookingStatusHistory.create({
        data: {
          bookingId: created.id,
          fromStatus: BookingStatus.PENDING,
          toStatus: BookingStatus.CONFIRMED,
          reason: `Walk-in booking created by venue owner/staff. Payment: ${dto.paymentMethod || 'CASH'}. Notes: ${dto.notes || 'None'}`,
          changedByUserId: userId,
        },
      });

      return created;
    });

    this.logger.log(
      `Owner ${userId} created walk-in booking ${booking.bookingNumber} for ${dto.customerName}`,
    );

    return {
      message: 'Walk-in booking created successfully',
      booking: {
        ...booking,
        customerName: dto.customerName,
        customerPhone: dto.customerPhone,
        paymentMethod: dto.paymentMethod || 'CASH',
        basePrice: Number(booking.basePrice),
        totalPrice: Number(booking.totalPrice),
      },
    };
  }

  /**
   * POST /api/v1/owner/bookings/:id/cancel
   * Owner cancels a booking on their venue (releases slot immediately)
   */
  async cancelOwnerBooking(
    bookingId: string,
    userId: string,
    userRoles: string[] = [],
    dto: OwnerCancelBookingDto,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { turf: { include: { owner: true } } },
    });

    if (!booking) {
      throw new NotFoundException(`Booking with ID '${bookingId}' not found`);
    }

    const isAdmin =
      userRoles.includes('ADMIN') || userRoles.includes('SUPER_ADMIN');
    if (booking.turf.owner?.userId !== userId && !isAdmin) {
      throw new ForbiddenException(
        'Access denied: You do not own this turf venue',
      );
    }

    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('Booking is already cancelled');
    }

    if (booking.status === BookingStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel a completed booking');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.CANCELLED,
          activeSlotKey: null, // Frees slot immediately!
          cancellationReason: dto.reason,
          cancelledAt: new Date(),
        },
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId,
          fromStatus: booking.status,
          toStatus: BookingStatus.CANCELLED,
          reason: `Cancelled by turf owner: ${dto.reason}`,
          changedByUserId: userId,
        },
      });

      return res;
    });

    this.logger.log(`Owner ${userId} cancelled booking ${bookingId}`);

    return {
      message: 'Booking cancelled successfully by turf owner',
      booking: {
        id: updated.id,
        bookingNumber: updated.bookingNumber,
        status: updated.status,
        cancellationReason: updated.cancellationReason,
        cancelledAt: updated.cancelledAt,
      },
    };
  }

  /**
   * POST /api/v1/owner/bookings/:id/reschedule
   * Owner reschedules booking to another time or day
   */
  async rescheduleOwnerBooking(
    bookingId: string,
    userId: string,
    userRoles: string[] = [],
    dto: OwnerRescheduleBookingDto,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { turf: { include: { owner: true } } },
    });

    if (!booking) {
      throw new NotFoundException(`Booking with ID '${bookingId}' not found`);
    }

    const isAdmin =
      userRoles.includes('ADMIN') || userRoles.includes('SUPER_ADMIN');
    if (booking.turf.owner?.userId !== userId && !isAdmin) {
      throw new ForbiddenException(
        'Access denied: You do not own this turf venue',
      );
    }

    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('Cannot reschedule a cancelled booking');
    }

    const newActiveSlotKey = `${booking.turfId}_${dto.newDate}_${dto.newStartTime}`;

    // Conflict check
    const existing = await this.prisma.booking.findUnique({
      where: { activeSlotKey: newActiveSlotKey },
    });

    if (existing && existing.id !== bookingId) {
      throw new ConflictException(
        `Target slot ${dto.newStartTime} on ${dto.newDate} is already booked`,
      );
    }

    // Check maintenance
    const blocked = await this.prisma.blockedSlot.findFirst({
      where: {
        turfId: booking.turfId,
        blockDate: new Date(dto.newDate),
        startTime: dto.newStartTime,
      },
    });

    if (blocked) {
      throw new ConflictException('Target slot is blocked for maintenance');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.booking.update({
        where: { id: bookingId },
        data: {
          bookingDate: new Date(dto.newDate),
          startTime: dto.newStartTime,
          endTime: dto.newEndTime || booking.endTime,
          activeSlotKey: newActiveSlotKey,
        },
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId,
          fromStatus: booking.status,
          toStatus: booking.status,
          reason: `Rescheduled by turf owner to ${dto.newDate} ${dto.newStartTime}. Reason: ${dto.reason || 'None'}`,
          changedByUserId: userId,
        },
      });

      return res;
    });

    this.logger.log(`Owner ${userId} rescheduled booking ${bookingId}`);

    return {
      message: 'Booking rescheduled successfully',
      booking: {
        id: updated.id,
        bookingNumber: updated.bookingNumber,
        bookingDate: updated.bookingDate,
        startTime: updated.startTime,
        endTime: updated.endTime,
        status: updated.status,
      },
    };
  }
}
