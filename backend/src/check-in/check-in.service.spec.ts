import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CheckInService } from './check-in.service';
import { PrismaService } from '../database/prisma.service';
import { BookingStatus } from '@prisma/client';

describe('CheckInService', () => {
  let service: CheckInService;
  let prisma: any;

  const mockBooking = {
    id: 'booking-uuid-1',
    bookingNumber: 'TB-20260926-ABCD',
    turfId: 'turf-uuid-1',
    userId: 'customer-uuid-1',
    bookingDate: new Date(),
    startTime: '06:00',
    endTime: '23:00',
    durationMinutes: 60,
    status: BookingStatus.CONFIRMED,
    totalPrice: 1200,
    checkedInAt: null,
    checkedOutAt: null,
    checkedInByUserId: null,
    checkedOutByUserId: null,
    turf: {
      id: 'turf-uuid-1',
      name: 'SanSam Arena Ground A',
      latitude: 12.9716,
      longitude: 77.5946,
      owner: {
        userId: 'owner-uuid-1',
      },
    },
    user: {
      id: 'customer-uuid-1',
      fullName: 'Rahul Dravid',
      phone: '+919999900000',
      email: 'rahul@cricket.in',
    },
    checkInAudits: [],
  };

  beforeEach(async () => {
    prisma = {
      booking: {
        findUnique: jest.fn().mockResolvedValue({ ...mockBooking }),
        update: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            ...mockBooking,
            ...data,
          }),
        ),
      },
      bookingCheckInAudit: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
      bookingStatusHistory: {
        create: jest.fn().mockResolvedValue({ id: 'status-hist-1' }),
      },
      $transaction: jest.fn((callback) => {
        if (typeof callback === 'function') {
          return callback(prisma);
        }
        return Promise.all(callback);
      }),
    };

    const config = {
      get: jest.fn((key: string, defaultVal?: any) => {
        if (key === 'checkin.qrSecret') return 'test-qr-secret-key-min-32-chars-long';
        return defaultVal;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckInService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get<CheckInService>(CheckInService);
  });

  describe('calculateDistanceMeters', () => {
    it('should accurately calculate distance between Bangalore coordinates and turf venue', () => {
      // 12.9716, 77.5946 (MG Road) to 12.9720, 77.5950 (~62 meters)
      const distance = service.calculateDistanceMeters(
        12.9716,
        77.5946,
        12.972,
        77.595,
      );
      expect(distance).toBeGreaterThan(50);
      expect(distance).toBeLessThan(80);
    });

    it('should return 0 meters for identical coordinates', () => {
      const distance = service.calculateDistanceMeters(
        12.9716,
        77.5946,
        12.9716,
        77.5946,
      );
      expect(distance).toBe(0);
    });
  });

  describe('checkIn with location', () => {
    it('should record user location, calculate distance from turf, and save audit log', async () => {
      const result = await service.checkIn(
        'booking-uuid-1',
        'customer-uuid-1',
        ['CUSTOMER'],
        'Gate checkin',
        {
          latitude: 12.9718,
          longitude: 77.5948,
          location: 'Main Gate Entrance',
          accuracy: 5.0,
        },
      );

      expect(result.message).toBe('Check-in successful');
      expect(result.userLocation).toEqual({
        latitude: 12.9718,
        longitude: 77.5948,
        location: 'Main Gate Entrance',
        accuracy: 5.0,
      });
      expect(result.distanceFromTurfMeters).toBeGreaterThan(0);
      expect(result.timestamp).toBeDefined();

      expect(prisma.bookingCheckInAudit.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actionType: 'CHECK_IN',
            performedByUserId: 'customer-uuid-1',
            metadata: expect.objectContaining({
              userLocation: {
                latitude: 12.9718,
                longitude: 77.5948,
                location: 'Main Gate Entrance',
                accuracy: 5.0,
              },
              distanceFromTurfMeters: expect.any(Number),
            }),
          }),
        }),
      );
    });
  });

  describe('checkOut with location', () => {
    it('should record user location and calculate distance on checkout', async () => {
      prisma.booking.findUnique.mockResolvedValueOnce({
        ...mockBooking,
        checkedInAt: new Date(Date.now() - 3600000),
      });

      const result = await service.checkOut(
        'booking-uuid-1',
        'customer-uuid-1',
        ['CUSTOMER'],
        'Leaving turf',
        {
          latitude: 12.9716,
          longitude: 77.5946,
          location: 'Exit gate',
          accuracy: 8.0,
        },
      );

      expect(result.message).toBe('Check-out completed successfully');
      expect(result.userLocation).toEqual({
        latitude: 12.9716,
        longitude: 77.5946,
        location: 'Exit gate',
        accuracy: 8.0,
      });
      expect(result.distanceFromTurfMeters).toBe(0);
      expect(prisma.bookingCheckInAudit.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actionType: 'CHECK_OUT',
            metadata: expect.objectContaining({
              userLocation: {
                latitude: 12.9716,
                longitude: 77.5946,
                location: 'Exit gate',
                accuracy: 8.0,
              },
              distanceFromTurfMeters: 0,
            }),
          }),
        }),
      );
    });
  });

  describe('getCheckInStatus', () => {
    it('should return checkInLocation and distanceFromTurfMeters in status inquiry', async () => {
      prisma.booking.findUnique.mockResolvedValueOnce({
        ...mockBooking,
        checkedInAt: new Date(),
        checkInAudits: [
          {
            id: 'audit-1',
            actionType: 'CHECK_IN',
            performedAt: new Date(),
            performedBy: { id: 'customer-uuid-1', fullName: 'Rahul Dravid' },
            notes: 'Gate checkin',
            metadata: {
              userLocation: {
                latitude: 12.9718,
                longitude: 77.5948,
                location: 'Main Gate',
                accuracy: 5.0,
              },
              distanceFromTurfMeters: 31.4,
            },
          },
        ],
      });

      const status = await service.getCheckInStatus(
        'booking-uuid-1',
        'customer-uuid-1',
        ['CUSTOMER'],
      );

      expect(status.checkInLocation).toEqual({
        latitude: 12.9718,
        longitude: 77.5948,
        location: 'Main Gate',
        accuracy: 5.0,
      });
      expect(status.distanceFromTurfMeters).toBe(31.4);
      expect(status.audits[0].userLocation).toBeDefined();
    });
  });
});
