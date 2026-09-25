import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, GoneException } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { PrismaService } from '../database/prisma.service';
import { AvailabilityService } from '../availability/availability.service';
import { BookingStatus, HoldStatus } from '@prisma/client';

describe('BookingsService', () => {
  let service: BookingsService;
  let prisma: PrismaService;

  const mockTurf = {
    id: 'turf-1',
    name: 'Metropolis Turf',
    isActive: true,
    operatingHours: [
      {
        dayOfWeek: 1, // Monday
        openTime: '06:00',
        closeTime: '23:00',
        isClosed: false,
      },
    ],
    blockedSlots: [],
  };

  const mockHold = {
    id: 'hold-1',
    holdCode: 'HOLD-123456',
    userId: 'user-1',
    turfId: 'turf-1',
    holdDate: new Date('2026-09-28'),
    startTime: '18:00',
    endTime: '19:00',
    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // Active 10 mins
    status: HoldStatus.ACTIVE,
    totalPrice: 1500,
    activeHoldKey: 'turf-1_2026-09-28_18:00',
  };

  const mockBooking = {
    id: 'booking-1',
    bookingNumber: 'TB-20260928-ABCD',
    userId: 'user-1',
    turfId: 'turf-1',
    bookingDate: new Date('2026-09-28'),
    startTime: '18:00',
    endTime: '19:00',
    status: BookingStatus.CONFIRMED,
    activeSlotKey: 'turf-1_2026-09-28_18:00',
    totalPrice: 1500,
    turf: {
      id: 'turf-1',
      name: 'Metropolis Turf',
      owner: { userId: 'owner-1' },
    },
  };

  const mockPrismaService = {
    turf: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    slotHold: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    booking: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    bookingStatusHistory: {
      create: jest.fn(),
    },
    $executeRaw: jest.fn().mockResolvedValue(1),
    $transaction: jest.fn().mockImplementation((cb) => cb(mockPrismaService)),
  };

  const mockAvailabilityService = {
    getAvailableSlots: jest.fn().mockResolvedValue({
      slots: [
        {
          startTime: '18:00',
          endTime: '19:00',
          price: 1500,
          isAvailable: true,
        },
      ],
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AvailabilityService, useValue: mockAvailabilityService },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(prisma).toBeDefined();
  });

  describe('Slot Hold Operations', () => {
    it('should create an active 10-minute slot hold', async () => {
      mockPrismaService.turf.findFirst.mockResolvedValue(mockTurf);
      mockPrismaService.slotHold.findFirst.mockResolvedValue(null);
      mockPrismaService.booking.findFirst.mockResolvedValue(null);
      mockPrismaService.slotHold.create.mockResolvedValue(mockHold);

      const result = await service.createHold('user-1', {
        turfId: 'turf-1',
        holdDate: '2026-09-28', // Monday
        startTime: '18:00',
        endTime: '19:00',
      });

      expect(result.status).toBe(HoldStatus.ACTIVE);
      expect(result.holdCode).toBe('HOLD-123456');
      expect(mockPrismaService.$executeRaw).toHaveBeenCalled();
    });

    it('should reject hold if slot is already held by another customer', async () => {
      mockPrismaService.turf.findFirst.mockResolvedValue(mockTurf);
      mockPrismaService.slotHold.findFirst.mockResolvedValue({
        ...mockHold,
        userId: 'other-user',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      });

      await expect(
        service.createHold('user-1', {
          turfId: 'turf-1',
          holdDate: '2026-09-28',
          startTime: '18:00',
          endTime: '19:00',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject hold if slot is already booked', async () => {
      mockPrismaService.turf.findFirst.mockResolvedValue(mockTurf);
      mockPrismaService.slotHold.findFirst.mockResolvedValue(null);
      mockPrismaService.booking.findFirst.mockResolvedValue(mockBooking);

      await expect(
        service.createHold('user-1', {
          turfId: 'turf-1',
          holdDate: '2026-09-28',
          startTime: '18:00',
          endTime: '19:00',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('Booking Confirmation & Double Booking Prevention', () => {
    it('should confirm booking from active hold and record status history', async () => {
      mockPrismaService.slotHold.findUnique.mockResolvedValue(mockHold);
      mockPrismaService.booking.findFirst.mockResolvedValue(null);
      mockPrismaService.booking.create.mockResolvedValue(mockBooking);

      const result = await service.createBooking('user-1', {
        holdId: 'hold-1',
      });

      expect(result.status).toBe(BookingStatus.CONFIRMED);
      expect(mockPrismaService.slotHold.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'hold-1' },
          data: expect.objectContaining({
            status: HoldStatus.CONVERTED,
            activeHoldKey: null,
          }),
        }),
      );
      expect(
        mockPrismaService.bookingStatusHistory.create,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            toStatus: BookingStatus.CONFIRMED,
          }),
        }),
      );
    });

    it('should reject booking if hold has expired', async () => {
      mockPrismaService.slotHold.findUnique.mockResolvedValue({
        ...mockHold,
        expiresAt: new Date(Date.now() - 1000), // Expired in past
      });

      await expect(
        service.createBooking('user-1', { holdId: 'hold-1' }),
      ).rejects.toThrow(GoneException);
    });

    it('should prevent double booking if slot already confirmed', async () => {
      mockPrismaService.slotHold.findUnique.mockResolvedValue(mockHold);
      mockPrismaService.booking.findFirst.mockResolvedValue(mockBooking);

      await expect(
        service.createBooking('user-1', { holdId: 'hold-1' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should return existing booking on idempotencyKey retry', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValue(mockBooking);

      const result = await service.createBooking('user-1', {
        holdId: 'hold-1',
        idempotencyKey: 'idem-key-1',
      });

      expect(result).toEqual(mockBooking);
      expect(mockPrismaService.booking.create).not.toHaveBeenCalled();
    });
  });

  describe('Cancellation & Rescheduling', () => {
    it('should cancel booking, release activeSlotKey, and record history', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValue(mockBooking);
      mockPrismaService.booking.update.mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.CANCELLED,
        activeSlotKey: null,
      });

      const result = await service.cancelBooking(
        'user-1',
        ['CUSTOMER'],
        'booking-1',
        {
          reason: 'Heavy Rain',
        },
      );

      expect(result.status).toBe(BookingStatus.CANCELLED);
      expect(mockPrismaService.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: BookingStatus.CANCELLED,
            activeSlotKey: null,
          }),
        }),
      );
      expect(
        mockPrismaService.bookingStatusHistory.create,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            toStatus: BookingStatus.CANCELLED,
          }),
        }),
      );
    });

    it('should atomically reschedule booking to a new available slot', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValue(mockBooking);
      mockPrismaService.slotHold.findFirst.mockResolvedValue(null);
      mockPrismaService.booking.findFirst.mockResolvedValue(null);
      mockPrismaService.booking.update.mockResolvedValue({
        ...mockBooking,
        bookingDate: new Date('2026-09-30'),
        startTime: '19:00',
        endTime: '20:00',
        activeSlotKey: 'turf-1_2026-09-30_19:00',
      });

      const result = await service.rescheduleBooking(
        'user-1',
        ['CUSTOMER'],
        'booking-1',
        {
          newDate: '2026-09-30',
          newStartTime: '19:00',
          newEndTime: '20:00',
        },
      );

      expect(result.startTime).toBe('19:00');
      expect(mockPrismaService.$executeRaw).toHaveBeenCalled();
      expect(mockPrismaService.bookingStatusHistory.create).toHaveBeenCalled();
    });

    it('should reject reschedule if target slot is already booked', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValue(mockBooking);
      mockPrismaService.slotHold.findFirst.mockResolvedValue(null);
      mockPrismaService.booking.findFirst.mockResolvedValue({
        id: 'conflicting-booking',
      });

      await expect(
        service.rescheduleBooking('user-1', ['CUSTOMER'], 'booking-1', {
          newDate: '2026-09-30',
          newStartTime: '19:00',
          newEndTime: '20:00',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });
});
