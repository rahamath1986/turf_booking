import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, HoldStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { Role } from '../common/enums/role.enum';
import { AvailabilityQueryDto } from './dto/availability-query.dto';
import { AvailableSlotsQueryDto } from './dto/available-slots-query.dto';
import { SetAvailabilityDto } from './dto/set-operating-hours.dto';
import { BlockSlotDto } from './dto/block-slot.dto';

export interface CalculatedSlot {
  slotId: string;
  startTime: string;
  endTime: string;
  durationMinutes?: number;
  date: string;
  isAvailable: boolean;
  status: 'AVAILABLE' | 'BLOCKED' | 'BOOKED' | 'HELD';
  isBooked: boolean;
  price: number;
  pricingType: string;
  ruleName: string;
  blockReason: string | null;
  blockedSlotId: string | null;
}

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // TIME & DATE HELPER UTILITIES
  // ---------------------------------------------------------------------------

  private timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  private minutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  private isTimeInWindow(
    slotTime: string,
    windowStart: string,
    windowEnd: string,
  ): boolean {
    const slotMin = this.timeToMinutes(slotTime);
    const startMin = this.timeToMinutes(windowStart);
    let endMin = this.timeToMinutes(windowEnd);
    if (endMin === 0 || windowEnd === '00:00' || windowEnd === '24:00') {
      endMin = 24 * 60;
    }
    return slotMin >= startMin && slotMin < endMin;
  }

  private isOverlapping(
    slotStart: string,
    slotEnd: string,
    blockStart: string,
    blockEnd: string,
  ): boolean {
    const sStart = this.timeToMinutes(slotStart);
    const sEnd =
      slotEnd === '00:00' || slotEnd === '24:00'
        ? 24 * 60
        : this.timeToMinutes(slotEnd);
    const bStart = this.timeToMinutes(blockStart);
    const bEnd =
      blockEnd === '00:00' || blockEnd === '24:00'
        ? 24 * 60
        : this.timeToMinutes(blockEnd);
    return sStart < bEnd && sEnd > bStart;
  }

  private getDayName(dayOfWeek: number): string {
    const days = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];
    return days[dayOfWeek] ?? 'Unknown';
  }

  private formatDateIso(d: Date): string {
    return d.toISOString().split('T')[0];
  }

  // ---------------------------------------------------------------------------
  // MULTI-TENANT OWNER AUTHORIZATION GUARD
  // ---------------------------------------------------------------------------

  async assertTurfOwnership(
    turfId: string,
    userId: string,
    userRoles: string[],
  ) {
    const turf = await this.prisma.turf.findFirst({
      where: { id: turfId, deletedAt: null },
      include: {
        owner: true,
      },
    });

    if (!turf) {
      throw new NotFoundException(`Turf with ID "${turfId}" not found`);
    }

    const isPlatformAdmin =
      userRoles.includes(Role.SUPER_ADMIN) || userRoles.includes(Role.ADMIN);

    if (!isPlatformAdmin && turf.owner.userId !== userId) {
      throw new ForbiddenException(
        'You are not authorized to manage this turf',
      );
    }

    return turf;
  }

  // ---------------------------------------------------------------------------
  // CUSTOMER APIS
  // ---------------------------------------------------------------------------

  /**
   * GET /api/v1/turfs/:id/availability
   * Returns high-level operating status and slot availability metrics for consecutive dates.
   */
  async getTurfAvailability(turfId: string, query: AvailabilityQueryDto) {
    const turf = await this.prisma.turf.findFirst({
      where: { id: turfId, deletedAt: null },
      include: {
        operatingHours: true,
      },
    });

    if (!turf) {
      throw new NotFoundException(`Turf with ID "${turfId}" not found`);
    }

    const startDate = query.date ? new Date(query.date) : new Date();
    const daysCount = query.days ?? 7;

    const calendar = [];

    for (let i = 0; i < daysCount; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      const dateStr = this.formatDateIso(currentDate);
      const dayOfWeek = currentDate.getDay();

      const oh = turf.operatingHours.find((h) => h.dayOfWeek === dayOfWeek);

      const isClosed = !oh || oh.isClosed;
      let totalSlots = 0;
      let openTime: string | null = null;
      let closeTime: string | null = null;
      const defaultDuration = (turf as any).slotDurationMinutes || 120;
      const slotDuration = oh?.slotDurationMinutes || defaultDuration;

      if (!isClosed && oh) {
        openTime = oh.openTime;
        closeTime = oh.closeTime;
        const openMin = this.timeToMinutes(oh.openTime);
        const closeMin =
          oh.closeTime === '00:00' || oh.closeTime === '24:00'
            ? 24 * 60
            : this.timeToMinutes(oh.closeTime);
        totalSlots = Math.max(0, Math.floor((closeMin - openMin) / slotDuration));
      }

      // Query blocked slots, active bookings, and active holds for this date
      const [blockedRecords, activeBookings, activeHolds] = await Promise.all([
        this.prisma.blockedSlot.findMany({
          where: {
            turfId,
            blockDate: new Date(dateStr),
          },
        }),
        this.prisma.booking.findMany({
          where: {
            turfId,
            bookingDate: new Date(dateStr),
            status: {
              in: [
                BookingStatus.CONFIRMED,
                BookingStatus.PENDING,
                BookingStatus.PAYMENT_PENDING,
              ],
            },
          },
          select: {
            startTime: true,
            endTime: true,
            timeSlots: true,
          },
        }),
        this.prisma.slotHold.findMany({
          where: {
            turfId,
            holdDate: new Date(dateStr),
            status: HoldStatus.ACTIVE,
            expiresAt: { gt: new Date() },
          },
          select: {
            startTime: true,
            endTime: true,
            timeSlots: true,
          },
        }),
      ]);

      // Count blocked/occupied slot units
      let blockedSlotsCount = 0;
      if (!isClosed && oh) {
        const openMin = this.timeToMinutes(oh.openTime);
        const closeMin =
          oh.closeTime === '00:00' || oh.closeTime === '24:00'
            ? 24 * 60
            : this.timeToMinutes(oh.closeTime);

        for (let m = openMin; m + slotDuration <= closeMin; m += slotDuration) {
          const sStart = this.minutesToTime(m);
          const sEnd = this.minutesToTime(m + slotDuration);

          const isBlocked = blockedRecords.some((b) =>
            this.isOverlapping(sStart, sEnd, b.startTime, b.endTime),
          );

          const isBooked = activeBookings.some((b) => {
            if (Array.isArray(b.timeSlots) && b.timeSlots.length > 0) {
              return (b.timeSlots as any[]).some(
                (ts) =>
                  ts.startTime === sStart ||
                  this.isOverlapping(sStart, sEnd, ts.startTime, ts.endTime),
              );
            }
            return this.isOverlapping(sStart, sEnd, b.startTime, b.endTime);
          });

          const isHeld = activeHolds.some((h) => {
            if (Array.isArray(h.timeSlots) && h.timeSlots.length > 0) {
              return (h.timeSlots as any[]).some(
                (ts) =>
                  ts.startTime === sStart ||
                  this.isOverlapping(sStart, sEnd, ts.startTime, ts.endTime),
              );
            }
            return this.isOverlapping(sStart, sEnd, h.startTime, h.endTime);
          });

          if (isBlocked || isBooked || isHeld) blockedSlotsCount++;
        }
      }

      const availableSlotsCount = Math.max(0, totalSlots - blockedSlotsCount);

      calendar.push({
        date: dateStr,
        dayOfWeek,
        dayName: this.getDayName(dayOfWeek),
        isClosed,
        openTime,
        closeTime,
        slotDurationMinutes: slotDuration,
        totalSlots,
        blockedSlotsCount,
        availableSlotsCount,
        hasAvailability: availableSlotsCount > 0,
      });
    }

    return {
      turfId: turf.id,
      turfName: turf.name,
      calendar,
    };
  }

  /**
   * GET /api/v1/turfs/:id/available-slots
   * Calculates slot availability and dynamic pricing on-the-fly without persistent slot explosion.
   */
  async getAvailableSlots(turfId: string, query: AvailableSlotsQueryDto) {
    const turf = await this.prisma.turf.findFirst({
      where: { id: turfId, deletedAt: null },
      include: {
        operatingHours: true,
        pricingRules: {
          where: { isActive: true },
        },
      },
    });

    if (!turf) {
      throw new NotFoundException(`Turf with ID "${turfId}" not found`);
    }

    const targetDateStr = query.date ?? this.formatDateIso(new Date());
    const targetDate = new Date(targetDateStr);
    const dayOfWeek = targetDate.getDay();
    const dayName = this.getDayName(dayOfWeek);
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

    let oh = turf.operatingHours.find((h) => h.dayOfWeek === dayOfWeek);
    if (!oh && turf.operatingHours.length === 0) {
      oh = {
        id: `virtual-oh-${dayOfWeek}`,
        turfId: turf.id,
        dayOfWeek,
        openTime: (turf as any).openTime || '06:00',
        closeTime: (turf as any).closeTime || '22:00',
        slotDurationMinutes: (turf as any).slotDurationMinutes || 120,
        isClosed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    const defaultDuration = (turf as any).slotDurationMinutes || 120;
    const slotDuration = oh?.slotDurationMinutes || defaultDuration;

    if (!oh || oh.isClosed) {
      return {
        turfId: turf.id,
        turfName: turf.name,
        date: targetDateStr,
        dayOfWeek,
        dayName,
        isClosed: true,
        openTime: oh ? oh.openTime : ((turf as any).openTime || '06:00'),
        closeTime: oh ? oh.closeTime : ((turf as any).closeTime || '22:00'),
        slotDurationMinutes: slotDuration,
        closureReason: 'Venue is closed on this day',
        totalSlots: 0,
        availableCount: 0,
        blockedCount: 0,
        slots: [] as CalculatedSlot[],
      };
    }

    // Fetch blocked slots, active bookings, and active holds for this specific date
    const [blockedSlots, activeBookings, activeHolds] = await Promise.all([
      this.prisma.blockedSlot.findMany({
        where: {
          turfId,
          blockDate: new Date(targetDateStr),
        },
      }),
      this.prisma.booking.findMany({
        where: {
          turfId,
          bookingDate: new Date(targetDateStr),
          status: {
            in: [
              BookingStatus.CONFIRMED,
              BookingStatus.PENDING,
              BookingStatus.PAYMENT_PENDING,
            ],
          },
        },
        select: {
          startTime: true,
          endTime: true,
          timeSlots: true,
        },
      }),
      this.prisma.slotHold.findMany({
        where: {
          turfId,
          holdDate: new Date(targetDateStr),
          status: HoldStatus.ACTIVE,
          expiresAt: { gt: new Date() },
        },
        select: {
          startTime: true,
          endTime: true,
          timeSlots: true,
        },
      }),
    ]);

    const openMin = this.timeToMinutes(oh.openTime);
    let closeMin = this.timeToMinutes(oh.closeTime);
    if (
      closeMin === 0 ||
      oh.closeTime === '00:00' ||
      oh.closeTime === '24:00'
    ) {
      closeMin = 24 * 60;
    }

    const slots: CalculatedSlot[] = [];

    // Filter pricing rules matching sportId if provided
    const pricingRules = turf.pricingRules.filter((r) => {
      if (query.sportId && r.sportId && r.sportId !== query.sportId) {
        return false;
      }
      return true;
    });

    for (let m = openMin; m + slotDuration <= closeMin; m += slotDuration) {
      const slotStart = this.minutesToTime(m);
      const slotEnd = this.minutesToTime(m + slotDuration);

      // Check if blocked by venue maintenance
      const blockingRecord = blockedSlots.find((b) =>
        this.isOverlapping(slotStart, slotEnd, b.startTime, b.endTime),
      );

      // Check if already booked
      const isBooked = activeBookings.some((b) => {
        if (Array.isArray(b.timeSlots) && b.timeSlots.length > 0) {
          return (b.timeSlots as any[]).some(
            (ts) =>
              this.isOverlapping(slotStart, slotEnd, ts.startTime, ts.endTime),
          );
        }
        return this.isOverlapping(slotStart, slotEnd, b.startTime, b.endTime);
      });

      // Check if currently held
      const isHeld = activeHolds.some((h) => {
        if (Array.isArray(h.timeSlots) && h.timeSlots.length > 0) {
          return (h.timeSlots as any[]).some(
            (ts) =>
              this.isOverlapping(slotStart, slotEnd, ts.startTime, ts.endTime),
          );
        }
        return this.isOverlapping(slotStart, slotEnd, h.startTime, h.endTime);
      });

      const isUnavailable = !!blockingRecord || isBooked || isHeld;
      const blockReason = blockingRecord
        ? blockingRecord.reason || 'Blocked by Venue'
        : isBooked
          ? 'Booked'
          : isHeld
            ? 'Temporarily Held'
            : null;

      // Evaluate dynamic pricing hierarchy:
      // Priority 1: SPECIAL (matches specific date)
      // Priority 2: HOLIDAY (matches specific date or dayType=HOLIDAY)
      // Priority 3: PEAK (dayType=PEAK and slot in window)
      // Priority 4: OFF_PEAK (dayType=OFF_PEAK and slot in window)
      // Priority 5: WEEKEND (dayType=WEEKEND and isWeekend)
      // Priority 6: WEEKDAY (dayType=WEEKDAY and isWeekday)
      // Priority 7: ALL (general rule)
      // Fallback: Default rate (turf base price or 1000)

      let matchedRule = null;

      // 1. SPECIAL
      matchedRule = pricingRules.find(
        (r) =>
          r.dayType === 'SPECIAL' &&
          ((r.specificDate &&
            this.formatDateIso(r.specificDate) === targetDateStr) ||
            r.dayOfWeek === dayOfWeek) &&
          this.isTimeInWindow(slotStart, r.startTime, r.endTime),
      );

      // 2. HOLIDAY
      if (!matchedRule) {
        matchedRule = pricingRules.find(
          (r) =>
            r.dayType === 'HOLIDAY' &&
            ((r.specificDate &&
              this.formatDateIso(r.specificDate) === targetDateStr) ||
              r.dayOfWeek === dayOfWeek) &&
            this.isTimeInWindow(slotStart, r.startTime, r.endTime),
        );
      }

      // 3. PEAK
      if (!matchedRule) {
        matchedRule = pricingRules.find(
          (r) =>
            r.dayType === 'PEAK' &&
            (r.dayOfWeek === null || r.dayOfWeek === dayOfWeek) &&
            this.isTimeInWindow(slotStart, r.startTime, r.endTime),
        );
      }

      // 4. OFF_PEAK
      if (!matchedRule) {
        matchedRule = pricingRules.find(
          (r) =>
            r.dayType === 'OFF_PEAK' &&
            (r.dayOfWeek === null || r.dayOfWeek === dayOfWeek) &&
            this.isTimeInWindow(slotStart, r.startTime, r.endTime),
        );
      }

      // 5. WEEKEND
      if (!matchedRule && isWeekend) {
        matchedRule = pricingRules.find(
          (r) =>
            r.dayType === 'WEEKEND' &&
            this.isTimeInWindow(slotStart, r.startTime, r.endTime),
        );
      }

      // 6. WEEKDAY
      if (!matchedRule && isWeekday) {
        matchedRule = pricingRules.find(
          (r) =>
            r.dayType === 'WEEKDAY' &&
            this.isTimeInWindow(slotStart, r.startTime, r.endTime),
        );
      }

      // 7. ALL / DEFAULT
      if (!matchedRule) {
        matchedRule = pricingRules.find(
          (r) =>
            r.dayType === 'ALL' &&
            this.isTimeInWindow(slotStart, r.startTime, r.endTime),
        );
      }

      const hourlyRate = matchedRule ? Number(matchedRule.hourlyPrice) : 1000;
      const slotPrice = Math.round((hourlyRate * slotDuration) / 60);

      const pricingType = matchedRule
        ? matchedRule.dayType
        : isWeekend
          ? 'WEEKEND'
          : 'WEEKDAY';
      const ruleName = matchedRule
        ? matchedRule.ruleName
        : 'Standard Base Rate';

      const slotStatus: 'AVAILABLE' | 'BLOCKED' | 'BOOKED' | 'HELD' = isBooked
        ? 'BOOKED'
        : isHeld
          ? 'HELD'
          : blockingRecord
            ? 'BLOCKED'
            : 'AVAILABLE';

      slots.push({
        slotId: `${targetDateStr}_${slotStart.replace(':', '')}_${slotEnd.replace(':', '')}`,
        startTime: slotStart,
        endTime: slotEnd,
        durationMinutes: slotDuration,
        date: targetDateStr,
        isAvailable: !isUnavailable,
        status: slotStatus,
        isBooked: isBooked || isHeld,
        price: slotPrice,
        pricingType,
        ruleName,
        blockReason,
        blockedSlotId: blockingRecord ? blockingRecord.id : null,
      });
    }

    const availableCount = slots.filter((s) => s.isAvailable).length;
    const blockedCount = slots.length - availableCount;

    return {
      turfId: turf.id,
      turfName: turf.name,
      date: targetDateStr,
      dayOfWeek,
      dayName,
      isClosed: false,
      openTime: oh.openTime,
      closeTime: oh.closeTime,
      slotDurationMinutes: slotDuration,
      totalSlots: slots.length,
      availableCount,
      blockedCount,
      slots,
    };
  }

  /**
   * GET /api/v1/turfs/:id/pricing
   * Returns current active pricing rules matrix and structure for a turf.
   */
  async getTurfPricing(turfId: string) {
    const turf = await this.prisma.turf.findFirst({
      where: { id: turfId, deletedAt: null },
      include: {
        operatingHours: {
          orderBy: { dayOfWeek: 'asc' },
        },
        pricingRules: {
          where: { isActive: true },
          orderBy: [{ dayType: 'asc' }, { startTime: 'asc' }],
        },
      },
    });

    if (!turf) {
      throw new NotFoundException(`Turf with ID "${turfId}" not found`);
    }

    const rules = turf.pricingRules.map((r) => ({
      id: r.id,
      ruleName: r.ruleName,
      dayType: r.dayType,
      dayOfWeek: r.dayOfWeek,
      dayName: r.dayOfWeek !== null ? this.getDayName(r.dayOfWeek) : 'All Days',
      specificDate: r.specificDate ? this.formatDateIso(r.specificDate) : null,
      startTime: r.startTime,
      endTime: r.endTime,
      hourlyPrice: Number(r.hourlyPrice),
      sportId: r.sportId,
      isActive: r.isActive,
    }));

    // Categorized breakdown
    const weekdayRules = rules.filter((r) => r.dayType === 'WEEKDAY');
    const weekendRules = rules.filter((r) => r.dayType === 'WEEKEND');
    const peakRules = rules.filter((r) => r.dayType === 'PEAK');
    const offPeakRules = rules.filter((r) => r.dayType === 'OFF_PEAK');
    const holidayRules = rules.filter((r) => r.dayType === 'HOLIDAY');
    const specialRules = rules.filter((r) => r.dayType === 'SPECIAL');

    return {
      turfId: turf.id,
      turfName: turf.name,
      pricingMatrix: {
        weekday: weekdayRules,
        weekend: weekendRules,
        peakHours: peakRules,
        offPeak: offPeakRules,
        holidays: holidayRules,
        specialPricing: specialRules,
        allRules: rules,
      },
      operatingHours: turf.operatingHours.map((oh) => ({
        dayOfWeek: oh.dayOfWeek,
        dayName: this.getDayName(oh.dayOfWeek),
        openTime: oh.openTime,
        closeTime: oh.closeTime,
        isClosed: oh.isClosed,
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // OWNER APIS (Protected with Multi-Tenant Ownership Authorization)
  // ---------------------------------------------------------------------------

  /**
   * GET /api/v1/owner/turfs/:id/availability
   * Retrieves owner configuration for operating hours, upcoming blocked slots, and pricing rules.
   */
  async getOwnerAvailability(
    userId: string,
    userRoles: string[],
    turfId: string,
  ) {
    await this.assertTurfOwnership(turfId, userId, userRoles);

    const [turf, operatingHours, blockedSlots, pricingRules] = await Promise.all([
      this.prisma.turf.findUnique({
        where: { id: turfId },
        select: {
          id: true,
          openTime: true,
          closeTime: true,
          slotDurationMinutes: true,
        },
      }),
      this.prisma.operatingHour.findMany({
        where: { turfId },
        orderBy: { dayOfWeek: 'asc' },
      }),
      this.prisma.blockedSlot.findMany({
        where: {
          turfId,
          blockDate: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
        orderBy: [{ blockDate: 'asc' }, { startTime: 'asc' }],
      }),
      this.prisma.pricingRule.findMany({
        where: { turfId, isActive: true },
        orderBy: { dayType: 'asc' },
      }),
    ]);

    return {
      turfId,
      openTime: turf?.openTime || '06:00',
      closeTime: turf?.closeTime || '22:00',
      slotDurationMinutes: turf?.slotDurationMinutes || 120,
      operatingHours: operatingHours.map((oh) => ({
        id: oh.id,
        dayOfWeek: oh.dayOfWeek,
        dayName: this.getDayName(oh.dayOfWeek),
        openTime: oh.openTime,
        closeTime: oh.closeTime,
        slotDurationMinutes: oh.slotDurationMinutes || turf?.slotDurationMinutes || 120,
        isClosed: oh.isClosed,
      })),
      upcomingBlockedSlots: blockedSlots.map((b) => ({
        id: b.id,
        blockDate: this.formatDateIso(b.blockDate),
        startTime: b.startTime,
        endTime: b.endTime,
        reason: b.reason,
        createdAt: b.createdAt,
      })),
      pricingRules: pricingRules.map((r) => ({
        id: r.id,
        ruleName: r.ruleName,
        dayType: r.dayType,
        dayOfWeek: r.dayOfWeek,
        specificDate: r.specificDate
          ? this.formatDateIso(r.specificDate)
          : null,
        startTime: r.startTime,
        endTime: r.endTime,
        hourlyPrice: Number(r.hourlyPrice),
      })),
    };
  }

  /**
   * POST /api/v1/owner/turfs/:id/availability
   * Bulk creates or sets the operating hours and pricing rules for the turf.
   */
  async setOwnerAvailability(
    userId: string,
    userRoles: string[],
    turfId: string,
    dto: SetAvailabilityDto,
  ) {
    await this.assertTurfOwnership(turfId, userId, userRoles);

    return this.prisma.$transaction(async (tx) => {
      // Update turf-level default timing and slot duration if provided
      if (dto.openTime || dto.closeTime || dto.slotDurationMinutes) {
        const turfUpdate: any = {};
        if (dto.openTime) turfUpdate.openTime = dto.openTime;
        if (dto.closeTime) turfUpdate.closeTime = dto.closeTime;
        if (dto.slotDurationMinutes) turfUpdate.slotDurationMinutes = dto.slotDurationMinutes;
        await tx.turf.update({
          where: { id: turfId },
          data: turfUpdate,
        });
      }

      // Upsert operating hours for each specified day of week
      for (const item of dto.operatingHours) {
        await tx.operatingHour.upsert({
          where: {
            turfId_dayOfWeek: {
              turfId,
              dayOfWeek: item.dayOfWeek,
            },
          },
          update: {
            openTime: item.openTime,
            closeTime: item.closeTime,
            slotDurationMinutes: item.slotDurationMinutes ?? dto.slotDurationMinutes ?? 120,
            isClosed: item.isClosed ?? false,
          },
          create: {
            turfId,
            dayOfWeek: item.dayOfWeek,
            openTime: item.openTime,
            closeTime: item.closeTime,
            slotDurationMinutes: item.slotDurationMinutes ?? dto.slotDurationMinutes ?? 120,
            isClosed: item.isClosed ?? false,
          },
        });
      }

      // If pricing rules are provided, replace them
      if (dto.pricingRules && dto.pricingRules.length > 0) {
        await tx.pricingRule.deleteMany({ where: { turfId } });

        await tx.pricingRule.createMany({
          data: dto.pricingRules.map((r) => ({
            turfId,
            ruleName: r.ruleName,
            dayType: r.dayType,
            dayOfWeek: r.dayOfWeek ?? null,
            specificDate: r.specificDate ? new Date(r.specificDate) : null,
            startTime: r.startTime,
            endTime: r.endTime,
            hourlyPrice: r.hourlyPrice,
            sportId: r.sportId ?? null,
            isActive: r.isActive ?? true,
          })),
        });
      }

      const updatedHours = await tx.operatingHour.findMany({
        where: { turfId },
        orderBy: { dayOfWeek: 'asc' },
      });

      const updatedRules = await tx.pricingRule.findMany({
        where: { turfId },
      });

      return {
        message: 'Turf availability and schedule configured successfully',
        operatingHours: updatedHours,
        pricingRules: updatedRules,
      };
    });
  }

  /**
   * PUT /api/v1/owner/turfs/:id/availability
   * Updates existing operating hours and pricing rules for the turf.
   */
  async updateOwnerAvailability(
    userId: string,
    userRoles: string[],
    turfId: string,
    dto: SetAvailabilityDto,
  ) {
    return this.setOwnerAvailability(userId, userRoles, turfId, dto);
  }

  /**
   * POST /api/v1/owner/turfs/:id/block-slot
   * Blocks a timeslot or duration for maintenance, tournament, or owner hold.
   */
  async blockSlot(
    userId: string,
    userRoles: string[],
    turfId: string,
    dto: BlockSlotDto,
  ) {
    await this.assertTurfOwnership(turfId, userId, userRoles);

    const startMin = this.timeToMinutes(dto.startTime);
    let endMin = this.timeToMinutes(dto.endTime);
    if (endMin === 0 || dto.endTime === '00:00' || dto.endTime === '24:00') {
      endMin = 24 * 60;
    }

    if (startMin >= endMin) {
      throw new BadRequestException(
        'startTime must be strictly before endTime',
      );
    }

    const blockDate = new Date(dto.blockDate);
    if (isNaN(blockDate.getTime())) {
      throw new BadRequestException('Invalid blockDate format. Use YYYY-MM-DD');
    }

    const blockedSlot = await this.prisma.blockedSlot.create({
      data: {
        turfId,
        blockDate,
        startTime: dto.startTime,
        endTime: dto.endTime,
        reason: dto.reason || 'Maintenance',
        blockedByUserId: userId,
      },
    });

    return {
      message: 'Timeslot blocked successfully',
      blockedSlot: {
        id: blockedSlot.id,
        turfId: blockedSlot.turfId,
        blockDate: this.formatDateIso(blockedSlot.blockDate),
        startTime: blockedSlot.startTime,
        endTime: blockedSlot.endTime,
        reason: blockedSlot.reason,
        createdAt: blockedSlot.createdAt,
      },
    };
  }

  /**
   * DELETE /api/v1/owner/turfs/:id/block-slot/:slotId
   * Unblocks a previously blocked timeslot. Strictly enforces multi-tenant ownership.
   */
  async unblockSlot(
    userId: string,
    userRoles: string[],
    turfId: string,
    slotId: string,
  ) {
    await this.assertTurfOwnership(turfId, userId, userRoles);

    const blockedSlot = await this.prisma.blockedSlot.findFirst({
      where: {
        id: slotId,
        turfId,
      },
    });

    if (!blockedSlot) {
      throw new NotFoundException(
        `Blocked slot with ID "${slotId}" not found for this turf`,
      );
    }

    await this.prisma.blockedSlot.delete({
      where: { id: slotId },
    });

    return {
      message: 'Timeslot unblocked successfully',
      unblockedSlotId: slotId,
    };
  }
}
