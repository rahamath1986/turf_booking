import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { AvailabilityService } from './availability.service';
import { PrismaService } from '../database/prisma.service';
import { Role } from '../common/enums/role.enum';

describe('AvailabilityService', () => {
  let service: AvailabilityService;
  let prisma: PrismaService;

  const mockTurf = {
    id: 'turf-uuid-1',
    name: 'Champions Football Turf',
    ownerId: 'owner-profile-1',
    slotDurationMinutes: 60,
    owner: {
      id: 'owner-profile-1',
      userId: 'owner-user-1',
    },
    operatingHours: [
      {
        id: 'oh-wednesday',
        turfId: 'turf-uuid-1',
        dayOfWeek: 3, // Wednesday
        openTime: '06:00',
        closeTime: '23:00',
        isClosed: false,
      },
      {
        id: 'oh-saturday',
        turfId: 'turf-uuid-1',
        dayOfWeek: 6, // Saturday
        openTime: '06:00',
        closeTime: '23:00',
        isClosed: false,
      },
      {
        id: 'oh-sunday',
        turfId: 'turf-uuid-1',
        dayOfWeek: 0, // Sunday
        openTime: '00:00',
        closeTime: '00:00',
        isClosed: true, // Closed Sunday
      },
    ],
    pricingRules: [
      {
        id: 'rule-weekday',
        turfId: 'turf-uuid-1',
        ruleName: 'Standard Weekday',
        dayType: 'WEEKDAY',
        dayOfWeek: null,
        specificDate: null,
        startTime: '06:00',
        endTime: '18:00',
        hourlyPrice: 1000,
        isActive: true,
      },
      {
        id: 'rule-peak',
        turfId: 'turf-uuid-1',
        ruleName: 'Prime Peak Evening',
        dayType: 'PEAK',
        dayOfWeek: null,
        specificDate: null,
        startTime: '18:00',
        endTime: '22:00',
        hourlyPrice: 2000,
        isActive: true,
      },
      {
        id: 'rule-weekend',
        turfId: 'turf-uuid-1',
        ruleName: 'Weekend Prime',
        dayType: 'WEEKEND',
        dayOfWeek: null,
        specificDate: null,
        startTime: '06:00',
        endTime: '23:00',
        hourlyPrice: 1600,
        isActive: true,
      },
    ],
  };

  const mockPrismaService = {
    turf: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    operatingHour: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    pricingRule: {
      findMany: jest.fn(),
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    blockedSlot: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    booking: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    slotHold: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn().mockImplementation((cb) => cb(mockPrismaService)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvailabilityService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AvailabilityService>(AvailabilityService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(prisma).toBeDefined();
  });

  describe('Slot Calculation & Dynamic Pricing Scenarios', () => {
    it('1. normal slot: should calculate open weekday slot with base weekday pricing', async () => {
      // 2026-09-23 is Wednesday (dayOfWeek 3)
      mockPrismaService.turf.findFirst.mockResolvedValue(mockTurf);
      mockPrismaService.blockedSlot.findMany.mockResolvedValue([]);

      const result = await service.getAvailableSlots('turf-uuid-1', {
        date: '2026-09-23',
      });

      expect(result.isClosed).toBe(false);
      expect(result.totalSlots).toBe(17); // 06:00 to 23:00 = 17 hours
      expect(result.availableCount).toBe(17);

      // Morning slot 09:00 - 10:00
      const morningSlot = result.slots.find((s) => s.startTime === '09:00');
      expect(morningSlot).toBeDefined();
      expect(morningSlot?.isAvailable).toBe(true);
      expect(morningSlot?.status).toBe('AVAILABLE');
      expect(morningSlot?.pricingType).toBe('WEEKDAY');
      expect(morningSlot?.price).toBe(1000);
    });

    it('2. peak pricing: should apply peak pricing rule during peak hours', async () => {
      mockPrismaService.turf.findFirst.mockResolvedValue(mockTurf);
      mockPrismaService.blockedSlot.findMany.mockResolvedValue([]);

      const result = await service.getAvailableSlots('turf-uuid-1', {
        date: '2026-09-23', // Wednesday
      });

      // Evening slot 18:00 - 19:00 falls in PEAK (18:00 - 22:00)
      const peakSlot = result.slots.find((s) => s.startTime === '18:00');
      expect(peakSlot).toBeDefined();
      expect(peakSlot?.pricingType).toBe('PEAK');
      expect(peakSlot?.price).toBe(2000);
      expect(peakSlot?.ruleName).toBe('Prime Peak Evening');
    });

    it('3. weekend pricing: should evaluate weekend rates on Saturday and Sunday', async () => {
      // 2026-09-26 is Saturday (dayOfWeek 6)
      mockPrismaService.turf.findFirst.mockResolvedValue(mockTurf);
      mockPrismaService.blockedSlot.findMany.mockResolvedValue([]);

      const result = await service.getAvailableSlots('turf-uuid-1', {
        date: '2026-09-26',
      });

      expect(result.isClosed).toBe(false);
      const slot = result.slots.find((s) => s.startTime === '10:00');
      expect(slot).toBeDefined();
      expect(slot?.price).toBe(1600);
      expect(slot?.pricingType).toBe('WEEKEND');
      expect(slot?.ruleName).toBe('Weekend Prime');
    });

    it('4. closed day: should return 0 slots and isClosed=true when turf is closed', async () => {
      // 2026-09-27 is Sunday (dayOfWeek 0)
      mockPrismaService.turf.findFirst.mockResolvedValue(mockTurf);

      const result = await service.getAvailableSlots('turf-uuid-1', {
        date: '2026-09-27',
      });

      expect(result.isClosed).toBe(true);
      expect(result.totalSlots).toBe(0);
      expect(result.availableCount).toBe(0);
      expect(result.slots).toHaveLength(0);
      expect(result.closureReason).toBe('Venue is closed on this day');
    });

    it('5. blocked slot & maintenance: should mark slot BLOCKED when overlapping maintenance window', async () => {
      mockPrismaService.turf.findFirst.mockResolvedValue(mockTurf);
      mockPrismaService.blockedSlot.findMany.mockResolvedValue([
        {
          id: 'blocked-1',
          turfId: 'turf-uuid-1',
          blockDate: new Date('2026-09-23'),
          startTime: '14:00',
          endTime: '16:00',
          reason: 'Maintenance',
        },
      ]);

      const result = await service.getAvailableSlots('turf-uuid-1', {
        date: '2026-09-23',
      });

      const slot14 = result.slots.find((s) => s.startTime === '14:00');
      const slot15 = result.slots.find((s) => s.startTime === '15:00');
      const slot16 = result.slots.find((s) => s.startTime === '16:00');

      expect(slot14?.isAvailable).toBe(false);
      expect(slot14?.status).toBe('BLOCKED');
      expect(slot14?.blockReason).toBe('Maintenance');

      expect(slot15?.isAvailable).toBe(false);
      expect(slot15?.status).toBe('BLOCKED');
      expect(slot15?.blockReason).toBe('Maintenance');

      // Slot starting at 16:00 is after maintenance window -> AVAILABLE
      expect(slot16?.isAvailable).toBe(true);
      expect(slot16?.status).toBe('AVAILABLE');
      expect(slot16?.blockReason).toBeNull();
    });

    it('6. booked & held slots: should mark multi-slot booked times as BLOCKED with reason Booked', async () => {
      mockPrismaService.turf.findFirst.mockResolvedValue(mockTurf);
      mockPrismaService.blockedSlot.findMany.mockResolvedValue([]);
      mockPrismaService.booking.findMany.mockResolvedValue([
        {
          startTime: '18:00',
          endTime: '20:00',
          timeSlots: [
            { startTime: '18:00', endTime: '19:00', price: 1000 },
            { startTime: '19:00', endTime: '20:00', price: 1000 },
          ],
        },
      ]);
      mockPrismaService.slotHold.findMany.mockResolvedValue([
        {
          startTime: '20:00',
          endTime: '21:00',
          timeSlots: null,
        },
      ]);

      const result = await service.getAvailableSlots('turf-uuid-1', {
        date: '2026-09-23',
      });

      const slot18 = result.slots.find((s) => s.startTime === '18:00');
      const slot19 = result.slots.find((s) => s.startTime === '19:00');
      const slot20 = result.slots.find((s) => s.startTime === '20:00');
      const slot21 = result.slots.find((s) => s.startTime === '21:00');

      expect(slot18?.isAvailable).toBe(false);
      expect(slot18?.status).toBe('BOOKED');
      expect(slot18?.isBooked).toBe(true);
      expect(slot18?.blockReason).toBe('Booked');

      expect(slot19?.isAvailable).toBe(false);
      expect(slot19?.status).toBe('BOOKED');
      expect(slot19?.isBooked).toBe(true);
      expect(slot19?.blockReason).toBe('Booked');

      expect(slot20?.isAvailable).toBe(false);
      expect(slot20?.status).toBe('HELD');
      expect(slot20?.isBooked).toBe(true);
      expect(slot20?.blockReason).toBe('Temporarily Held');

      expect(slot21?.isAvailable).toBe(true);
      expect(slot21?.status).toBe('AVAILABLE');
      expect(slot21?.isBooked).toBe(false);
    });

    it('7. default 2hr slots: open from 06:00 to 22:00, last slot starts at 20:00 (8:00 PM), and booked slot marked correctly', async () => {
      const turfWith2HrSlots = {
        ...mockTurf,
        openTime: '06:00',
        closeTime: '22:00',
        slotDurationMinutes: 120,
        operatingHours: [
          {
            id: 'oh-wednesday-2hr',
            turfId: 'turf-uuid-1',
            dayOfWeek: 3,
            openTime: '06:00',
            closeTime: '22:00',
            slotDurationMinutes: 120,
            isClosed: false,
          },
        ],
      };

      mockPrismaService.turf.findFirst.mockResolvedValue(turfWith2HrSlots);
      mockPrismaService.blockedSlot.findMany.mockResolvedValue([]);
      // Book the 18:00 to 20:00 slot
      mockPrismaService.booking.findMany.mockResolvedValue([
        {
          startTime: '18:00',
          endTime: '20:00',
          timeSlots: [
            { startTime: '18:00', endTime: '20:00', price: 2000, durationMinutes: 120 },
          ],
        },
      ]);
      mockPrismaService.slotHold.findMany.mockResolvedValue([]);

      const result = await service.getAvailableSlots('turf-uuid-1', {
        date: '2026-09-23',
      });

      expect(result.openTime).toBe('06:00');
      expect(result.closeTime).toBe('22:00');
      expect(result.slotDurationMinutes).toBe(120);
      expect(result.totalSlots).toBe(8); // (22 - 6) / 2 = 8 slots: 06:00, 08:00, 10:00, 12:00, 14:00, 16:00, 18:00, 20:00

      const slotStarts = result.slots.map((s) => s.startTime);
      expect(slotStarts).toEqual([
        '06:00',
        '08:00',
        '10:00',
        '12:00',
        '14:00',
        '16:00',
        '18:00',
        '20:00',
      ]);

      // Last slot starts at 20:00 (8:00 PM) and ends at 22:00 (10:00 PM)
      const lastSlot = result.slots[result.slots.length - 1];
      expect(lastSlot.startTime).toBe('20:00');
      expect(lastSlot.endTime).toBe('22:00');
      expect(lastSlot.durationMinutes).toBe(120);

      // Booked slot 18:00 - 20:00
      const bookedSlot = result.slots.find((s) => s.startTime === '18:00');
      expect(bookedSlot?.isAvailable).toBe(false);
      expect(bookedSlot?.status).toBe('BOOKED');
      expect(bookedSlot?.isBooked).toBe(true);
      expect(bookedSlot?.blockReason).toBe('Booked');

      // Available slot 20:00 - 22:00
      expect(lastSlot.isAvailable).toBe(true);
      expect(lastSlot.status).toBe('AVAILABLE');
      expect(lastSlot.isBooked).toBe(false);
    });
  });

  describe('Multi-Tenant Owner Authorization', () => {
    it('should allow owner to block slot for their turf', async () => {
      mockPrismaService.turf.findFirst.mockResolvedValue(mockTurf);
      mockPrismaService.blockedSlot.create.mockResolvedValue({
        id: 'new-block-id',
        turfId: 'turf-uuid-1',
        blockDate: new Date('2026-09-28'),
        startTime: '08:00',
        endTime: '10:00',
        reason: 'Grass Reseeding Maintenance',
        createdAt: new Date(),
      });

      const res = await service.blockSlot(
        'owner-user-1',
        [Role.TURF_OWNER],
        'turf-uuid-1',
        {
          blockDate: '2026-09-28',
          startTime: '08:00',
          endTime: '10:00',
          reason: 'Grass Reseeding Maintenance',
        },
      );

      expect(res.message).toBe('Timeslot blocked successfully');
      expect(res.blockedSlot.id).toBe('new-block-id');
    });

    it('should throw ForbiddenException if another owner tries to block slot', async () => {
      mockPrismaService.turf.findFirst.mockResolvedValue(mockTurf);

      await expect(
        service.blockSlot(
          'other-owner-user',
          [Role.TURF_OWNER],
          'turf-uuid-1',
          {
            blockDate: '2026-09-28',
            startTime: '08:00',
            endTime: '10:00',
          },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if startTime >= endTime', async () => {
      mockPrismaService.turf.findFirst.mockResolvedValue(mockTurf);

      await expect(
        service.blockSlot('owner-user-1', [Role.TURF_OWNER], 'turf-uuid-1', {
          blockDate: '2026-09-28',
          startTime: '15:00',
          endTime: '14:00', // Invalid interval
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow unblocking a slot by authorized owner', async () => {
      mockPrismaService.turf.findFirst.mockResolvedValue(mockTurf);
      mockPrismaService.blockedSlot.findFirst.mockResolvedValue({
        id: 'blocked-1',
        turfId: 'turf-uuid-1',
      });
      mockPrismaService.blockedSlot.delete.mockResolvedValue({
        id: 'blocked-1',
      });

      const res = await service.unblockSlot(
        'owner-user-1',
        [Role.TURF_OWNER],
        'turf-uuid-1',
        'blocked-1',
      );

      expect(res.message).toBe('Timeslot unblocked successfully');
      expect(res.unblockedSlotId).toBe('blocked-1');
    });

    it('should throw NotFoundException when unblocking a non-existent slot', async () => {
      mockPrismaService.turf.findFirst.mockResolvedValue(mockTurf);
      mockPrismaService.blockedSlot.findFirst.mockResolvedValue(null);

      await expect(
        service.unblockSlot(
          'owner-user-1',
          [Role.TURF_OWNER],
          'turf-uuid-1',
          'invalid-id',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
