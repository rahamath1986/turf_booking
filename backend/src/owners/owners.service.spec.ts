import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { OwnersService } from './owners.service';
import { PrismaService } from '../database/prisma.service';
import { BookingStatus } from '@prisma/client';

describe('OwnersService', () => {
  let service: OwnersService;

  const mockPrisma: any = {
    turfOwner: {
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    turf: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
    },
    booking: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    blockedSlot: {
      findFirst: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    bookingStatusHistory: {
      create: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb(mockPrisma)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OwnersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<OwnersService>(OwnersService);
    jest.clearAllMocks();
  });

  describe('getDashboardSummary', () => {
    it('should return empty metrics if owner has no turfs', async () => {
      mockPrisma.turfOwner.findUnique.mockResolvedValue(null);

      const res = await service.getDashboardSummary('user-1', ['TURF_OWNER']);
      expect(res.today.revenue).toBe(0);
      expect(res.activeTurfsCount).toBe(0);
      expect(res.allTime.bookingsCount).toBe(0);
    });

    it('should calculate today, monthly, and all-time KPIs correctly', async () => {
      mockPrisma.turfOwner.findUnique.mockResolvedValue({ id: 'owner-1' });
      mockPrisma.turf.findMany.mockResolvedValue([{ id: 'turf-1' }]);
      mockPrisma.turf.count.mockResolvedValue(1);

      const today = new Date();
      mockPrisma.booking.findMany
        .mockResolvedValueOnce([
          {
            id: 'b-1',
            bookingDate: today,
            startTime: '18:00',
            status: BookingStatus.CONFIRMED,
            totalPrice: 1200,
            sport: { name: 'Football' },
          },
          {
            id: 'b-2',
            bookingDate: today,
            startTime: '19:00',
            status: BookingStatus.COMPLETED,
            totalPrice: 1500,
            sport: { name: 'Football' },
          },
          {
            id: 'b-3',
            bookingDate: today,
            startTime: '20:00',
            status: BookingStatus.CANCELLED,
            totalPrice: 1000,
            sport: { name: 'Cricket' },
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'b-1',
            bookingNumber: 'BK-1',
            turf: { name: 'Sunrise Turf' },
            user: { fullName: 'Alice', phone: '+919999999999' },
            sport: { name: 'Football' },
            bookingDate: today,
            startTime: '18:00',
            endTime: '19:00',
            status: BookingStatus.CONFIRMED,
            totalPrice: 1200,
            createdAt: today,
          },
        ]);

      const res = await service.getDashboardSummary('user-1', ['TURF_OWNER']);

      expect(res.today.revenue).toBe(2700); // 1200 + 1500
      expect(res.today.bookingsCount).toBe(2);
      expect(res.allTime.bookingsCount).toBe(3);
      expect(res.allTime.cancelledCount).toBe(1);
      expect(res.allTime.completedCount).toBe(1);
      expect(res.cancellationRate).toBe(33.3);
      expect(res.topSport).toBe('Football');
      expect(res.activeTurfsCount).toBe(1);
      expect(res.recentBookings).toHaveLength(1);
    });
  });

  describe('getRevenueAnalytics', () => {
    it('should aggregate daily, monthly and turf breakdown', async () => {
      mockPrisma.turfOwner.findUnique.mockResolvedValue({ id: 'owner-1' });
      mockPrisma.turf.findMany
        .mockResolvedValueOnce([{ id: 'turf-1' }])
        .mockResolvedValueOnce([{ id: 'turf-1', name: 'Sunrise Turf' }]);

      mockPrisma.booking.findMany.mockResolvedValue([
        {
          turfId: 'turf-1',
          bookingDate: new Date('2026-09-20'),
          totalPrice: 1000,
        },
        {
          turfId: 'turf-1',
          bookingDate: new Date('2026-09-20'),
          totalPrice: 1200,
        },
        {
          turfId: 'turf-1',
          bookingDate: new Date('2026-09-21'),
          totalPrice: 800,
        },
      ]);

      const res = await service.getRevenueAnalytics(
        'user-1',
        ['TURF_OWNER'],
        {},
      );
      expect(res.totalRevenue).toBe(3000);
      expect(res.dailyRevenue).toHaveLength(2);
      expect(res.dailyRevenue[0].date).toBe('2026-09-20');
      expect(res.dailyRevenue[0].revenue).toBe(2200);
      expect(res.monthlyRevenue).toHaveLength(1);
      expect(res.turfBreakdown[0].totalRevenue).toBe(3000);
    });
  });

  describe('getBookingsAnalytics', () => {
    it('should calculate status breakdown, daily trend and cancellations', async () => {
      mockPrisma.turfOwner.findUnique.mockResolvedValue({ id: 'owner-1' });
      mockPrisma.turf.findMany
        .mockResolvedValueOnce([{ id: 'turf-1' }])
        .mockResolvedValueOnce([{ id: 'turf-1', name: 'Sunrise Turf' }]);

      mockPrisma.booking.findMany.mockResolvedValue([
        {
          turfId: 'turf-1',
          bookingDate: new Date('2026-09-20'),
          status: BookingStatus.CONFIRMED,
        },
        {
          turfId: 'turf-1',
          bookingDate: new Date('2026-09-20'),
          status: BookingStatus.CANCELLED,
        },
      ]);

      const res = await service.getBookingsAnalytics(
        'user-1',
        ['TURF_OWNER'],
        {},
      );
      expect(res.totalBookings).toBe(2);
      expect(res.byStatus[BookingStatus.CONFIRMED]).toBe(1);
      expect(res.byStatus[BookingStatus.CANCELLED]).toBe(1);
      expect(res.cancellationRate).toBe(50);
      expect(res.dailyTrend[0].confirmed).toBe(1);
      expect(res.dailyTrend[0].cancelled).toBe(1);
    });
  });

  describe('getOccupancyAnalytics', () => {
    it('should calculate venue occupancy percentage', async () => {
      mockPrisma.turfOwner.findUnique.mockResolvedValue({ id: 'owner-1' });
      mockPrisma.turf.findMany
        .mockResolvedValueOnce([{ id: 'turf-1' }])
        .mockResolvedValueOnce([{ id: 'turf-1', name: 'Sunrise Turf' }]);

      mockPrisma.booking.findMany.mockResolvedValue([
        { turfId: 'turf-1', bookingDate: new Date('2026-09-20') },
        { turfId: 'turf-1', bookingDate: new Date('2026-09-21') },
      ]);

      const res = await service.getOccupancyAnalytics(
        'user-1',
        ['TURF_OWNER'],
        {
          startDate: '2026-09-20',
          endDate: '2026-09-21',
        },
      );

      expect(res.turfOccupancies).toHaveLength(1);
      expect(res.turfOccupancies[0].bookedSlotsCount).toBe(2);
      expect(res.overallOccupancyRate).toBeGreaterThan(0);
    });
  });

  describe('getPeakHoursAnalytics', () => {
    it('should determine popular hourly slots and top sports', async () => {
      mockPrisma.turfOwner.findUnique.mockResolvedValue({ id: 'owner-1' });
      mockPrisma.turf.findMany.mockResolvedValue([{ id: 'turf-1' }]);

      mockPrisma.booking.findMany.mockResolvedValue([
        { startTime: '18:00', totalPrice: 1000, sport: { name: 'Football' } },
        { startTime: '18:00', totalPrice: 1000, sport: { name: 'Football' } },
        { startTime: '07:00', totalPrice: 800, sport: { name: 'Cricket' } },
      ]);

      const res = await service.getPeakHoursAnalytics(
        'user-1',
        ['TURF_OWNER'],
        {},
      );
      expect(res.popularSlots[0]).toBe('18:00');
      expect(res.popularSports[0].sportName).toBe('Football');
      expect(res.popularSports[0].count).toBe(2);
      expect(res.periodBreakdown.evening).toBe(2);
      expect(res.periodBreakdown.morning).toBe(1);
    });
  });

  describe('Owner Bookings Management', () => {
    describe('createWalkInBooking', () => {
      it('should throw ConflictException if slot is already booked', async () => {
        mockPrisma.turf.findFirst.mockResolvedValue({
          id: 'turf-1',
          owner: { userId: 'owner-user-id' },
        });
        mockPrisma.booking.findUnique.mockResolvedValue({ id: 'existing-b' });

        await expect(
          service.createWalkInBooking('owner-user-id', ['TURF_OWNER'], {
            turfId: 'turf-1',
            bookingDate: '2026-09-28',
            startTime: '18:00',
            endTime: '19:00',
            customerName: 'Bob Walkin',
            customerPhone: '+919876543210',
          }),
        ).rejects.toThrow(ConflictException);
      });

      it('should create walk-in booking and status history', async () => {
        mockPrisma.turf.findFirst.mockResolvedValue({
          id: 'turf-1',
          owner: { userId: 'owner-user-id' },
        });
        mockPrisma.booking.findUnique.mockResolvedValue(null);
        mockPrisma.blockedSlot.findFirst.mockResolvedValue(null);
        mockPrisma.user.findFirst.mockResolvedValue({ id: 'guest-user-1' });

        mockPrisma.booking.create.mockResolvedValue({
          id: 'b-walkin-1',
          bookingNumber: 'WLK-123',
          turfId: 'turf-1',
          userId: 'guest-user-1',
          status: BookingStatus.CONFIRMED,
          basePrice: 1200,
          totalPrice: 1200,
          turf: { name: 'Sunrise Turf' },
          sport: null,
        });

        const res = await service.createWalkInBooking(
          'owner-user-id',
          ['TURF_OWNER'],
          {
            turfId: 'turf-1',
            bookingDate: '2026-09-28',
            startTime: '18:00',
            endTime: '19:00',
            customerName: 'Bob Walkin',
            customerPhone: '+919876543210',
            price: 1200,
          },
        );

        expect(res.message).toBe('Walk-in booking created successfully');
        expect(res.booking.bookingNumber).toBe('WLK-123');
        expect(res.booking.status).toBe(BookingStatus.CONFIRMED);
      });
    });

    describe('cancelOwnerBooking', () => {
      it('should cancel booking and free activeSlotKey', async () => {
        mockPrisma.booking.findUnique.mockResolvedValue({
          id: 'b-1',
          status: BookingStatus.CONFIRMED,
          turf: { owner: { userId: 'owner-user-id' } },
        });
        mockPrisma.booking.update.mockResolvedValue({
          id: 'b-1',
          bookingNumber: 'BK-1',
          status: BookingStatus.CANCELLED,
          cancellationReason: 'Ground flood',
          cancelledAt: new Date(),
        });

        const res = await service.cancelOwnerBooking(
          'b-1',
          'owner-user-id',
          ['TURF_OWNER'],
          {
            reason: 'Ground flood',
          },
        );

        expect(res.message).toBe(
          'Booking cancelled successfully by turf owner',
        );
        expect(res.booking.status).toBe(BookingStatus.CANCELLED);
      });

      it('should throw BadRequestException if booking already cancelled', async () => {
        mockPrisma.booking.findUnique.mockResolvedValue({
          id: 'b-1',
          status: BookingStatus.CANCELLED,
          turf: { owner: { userId: 'owner-user-id' } },
        });

        await expect(
          service.cancelOwnerBooking('b-1', 'owner-user-id', ['TURF_OWNER'], {
            reason: 'Try again',
          }),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('rescheduleOwnerBooking', () => {
      it('should reschedule booking to new slot and update activeSlotKey', async () => {
        mockPrisma.booking.findUnique
          .mockResolvedValueOnce({
            id: 'b-1',
            turfId: 'turf-1',
            status: BookingStatus.CONFIRMED,
            endTime: '19:00',
            turf: { owner: { userId: 'owner-user-id' } },
          })
          .mockResolvedValueOnce(null); // conflict check returns null

        mockPrisma.blockedSlot.findFirst.mockResolvedValue(null);
        mockPrisma.booking.update.mockResolvedValue({
          id: 'b-1',
          bookingNumber: 'BK-1',
          bookingDate: new Date('2026-09-30'),
          startTime: '19:00',
          endTime: '20:00',
          status: BookingStatus.CONFIRMED,
        });

        const res = await service.rescheduleOwnerBooking(
          'b-1',
          'owner-user-id',
          ['TURF_OWNER'],
          {
            newDate: '2026-09-30',
            newStartTime: '19:00',
            newEndTime: '20:00',
            reason: 'Customer requested',
          },
        );

        expect(res.message).toBe('Booking rescheduled successfully');
        expect(res.booking.startTime).toBe('19:00');
      });
    });

    describe('Multi-tenant security', () => {
      it('should throw ForbiddenException if user does not own turf', async () => {
        mockPrisma.turf.findFirst.mockResolvedValue({
          id: 'turf-1',
          owner: { userId: 'legit-owner' },
        });

        await expect(
          service.createWalkInBooking('attacker-user', ['TURF_OWNER'], {
            turfId: 'turf-1',
            bookingDate: '2026-09-28',
            startTime: '18:00',
            endTime: '19:00',
            customerName: 'Attack',
            customerPhone: '+919999999999',
          }),
        ).rejects.toThrow(ForbiddenException);
      });
    });
  });
});
