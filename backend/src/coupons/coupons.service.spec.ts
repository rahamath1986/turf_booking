import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { CouponsService } from './coupons.service';
import { PrismaService } from '../database/prisma.service';
import { DiscountType } from './dto/create-coupon.dto';

describe('CouponsService', () => {
  let service: CouponsService;

  const mockPrisma = {
    coupon: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    couponUsage: {
      count: jest.fn(),
      create: jest.fn(),
    },
    booking: {
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CouponsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CouponsService>(CouponsService);
    jest.clearAllMocks();
  });

  describe('Rule 1 & 2: Expiry & Active Status', () => {
    it('should return invalid if coupon code not found', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue(null);

      const res = await service.validateCoupon({
        code: 'UNKNOWN',
        amount: 1000,
      });
      expect(res.valid).toBe(false);
      expect(res.message).toContain('does not exist');
    });

    it('should return invalid if coupon is inactive', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue({
        code: 'INACTIVE',
        isActive: false,
      });

      const res = await service.validateCoupon({
        code: 'INACTIVE',
        amount: 1000,
      });
      expect(res.valid).toBe(false);
      expect(res.message).toContain('no longer active');
    });

    it('should return invalid if coupon has expired', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue({
        code: 'EXPIRED',
        isActive: true,
        startDate: new Date('2020-01-01'),
        endDate: new Date('2020-01-02'),
      });

      const res = await service.validateCoupon({
        code: 'EXPIRED',
        amount: 1000,
      });
      expect(res.valid).toBe(false);
      expect(res.message).toContain('has expired');
    });
  });

  describe('Rule 3: Minimum Order Amount', () => {
    it('should return invalid if order amount is less than minOrderAmount', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue({
        code: 'MIN500',
        isActive: true,
        startDate: new Date('2020-01-01'),
        endDate: new Date('2099-01-01'),
        minOrderAmount: 500,
        totalUsageLimit: null,
      });

      const res = await service.validateCoupon({ code: 'MIN500', amount: 300 });
      expect(res.valid).toBe(false);
      expect(res.message).toContain('Minimum booking amount of ₹500 required');
    });
  });

  describe('Rule 4: Maximum Discount Cap & Percentage Calculation', () => {
    it('should correctly calculate percentage discount capped at maxDiscountAmount', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue({
        id: 'c-1',
        code: 'HALF50',
        isActive: true,
        startDate: new Date('2020-01-01'),
        endDate: new Date('2099-01-01'),
        discountType: 'PERCENTAGE',
        discountValue: 50, // 50% of 1000 is 500
        minOrderAmount: 100,
        maxDiscountAmount: 200, // Capped at 200
        totalUsageLimit: null,
        perUserLimit: 5,
        turfIds: [],
        sportTypes: [],
        isFirstBookingOnly: false,
      });

      const res = await service.validateCoupon({
        code: 'HALF50',
        amount: 1000,
      });
      expect(res.valid).toBe(true);
      expect(res.discountAmount).toBe(200); // capped at 200 instead of 500
      expect(res.finalAmount).toBe(800);
    });

    it('should correctly calculate flat discount', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue({
        id: 'c-2',
        code: 'FLAT150',
        isActive: true,
        startDate: new Date('2020-01-01'),
        endDate: new Date('2099-01-01'),
        discountType: 'FLAT',
        discountValue: 150,
        minOrderAmount: 500,
        maxDiscountAmount: null,
        totalUsageLimit: null,
        perUserLimit: 5,
        turfIds: [],
        sportTypes: [],
        isFirstBookingOnly: false,
      });

      const res = await service.validateCoupon({
        code: 'FLAT150',
        amount: 600,
      });
      expect(res.valid).toBe(true);
      expect(res.discountAmount).toBe(150);
      expect(res.finalAmount).toBe(450);
    });
  });

  describe('Rule 5: Total Global Usage Limit', () => {
    it('should return invalid when overall coupon redemptions reach totalUsageLimit', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue({
        code: 'LIMITED',
        isActive: true,
        startDate: new Date('2020-01-01'),
        endDate: new Date('2099-01-01'),
        totalUsageLimit: 10,
        currentUsageCount: 10,
      });

      const res = await service.validateCoupon({
        code: 'LIMITED',
        amount: 1000,
      });
      expect(res.valid).toBe(false);
      expect(res.message).toContain('reached its total usage limit');
    });
  });

  describe('Rule 6: Per-User Usage Limit', () => {
    it('should return invalid when single user exceeds perUserLimit', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue({
        id: 'c-user-lim',
        code: 'ONCEONLY',
        isActive: true,
        startDate: new Date('2020-01-01'),
        endDate: new Date('2099-01-01'),
        totalUsageLimit: 100,
        currentUsageCount: 5,
        perUserLimit: 1,
      });
      mockPrisma.couponUsage.count.mockResolvedValue(1);

      const res = await service.validateCoupon(
        { code: 'ONCEONLY', amount: 1000 },
        'user-123',
      );
      expect(res.valid).toBe(false);
      expect(res.message).toContain('maximum allowed redemptions');
    });
  });

  describe('Rule 7: Turf & Sport Restrictions', () => {
    it('should return invalid if turfId is not in restricted list', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue({
        code: 'SPECIFIC_TURF',
        isActive: true,
        startDate: new Date('2020-01-01'),
        endDate: new Date('2099-01-01'),
        turfIds: ['allowed-turf-uuid'],
        sportTypes: [],
        minOrderAmount: 0,
        totalUsageLimit: null,
      });

      const res = await service.validateCoupon({
        code: 'SPECIFIC_TURF',
        amount: 500,
        turfId: 'disallowed-turf-uuid',
      });
      expect(res.valid).toBe(false);
      expect(res.message).toContain('not valid for the selected turf venue');
    });

    it('should return invalid if sportType is not in allowed list', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue({
        code: 'CRICKET_ONLY',
        isActive: true,
        startDate: new Date('2020-01-01'),
        endDate: new Date('2099-01-01'),
        turfIds: [],
        sportTypes: ['CRICKET'],
        minOrderAmount: 0,
        totalUsageLimit: null,
      });

      const res = await service.validateCoupon({
        code: 'CRICKET_ONLY',
        amount: 500,
        sportType: 'FOOTBALL',
      });
      expect(res.valid).toBe(false);
      expect(res.message).toContain('only valid for CRICKET bookings');
    });
  });

  describe('Rule 8: First Booking Restriction', () => {
    it('should return invalid for first-booking coupon if user has confirmed prior bookings', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue({
        code: 'WELCOME_NEW',
        isActive: true,
        startDate: new Date('2020-01-01'),
        endDate: new Date('2099-01-01'),
        isFirstBookingOnly: true,
        totalUsageLimit: null,
      });
      mockPrisma.booking.count.mockResolvedValue(2);

      const res = await service.validateCoupon(
        { code: 'WELCOME_NEW', amount: 500 },
        'existing-user-id',
      );
      expect(res.valid).toBe(false);
      expect(res.message).toContain(
        'exclusively reserved for first-time bookings',
      );
    });

    it('should succeed for first-booking coupon if user has 0 prior bookings', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue({
        id: 'c-welcome',
        code: 'WELCOME_NEW',
        isActive: true,
        startDate: new Date('2020-01-01'),
        endDate: new Date('2099-01-01'),
        isFirstBookingOnly: true,
        totalUsageLimit: null,
        discountType: 'FLAT',
        discountValue: 100,
        minOrderAmount: 300,
        perUserLimit: 1,
        turfIds: [],
        sportTypes: [],
      });
      mockPrisma.booking.count.mockResolvedValue(0);
      mockPrisma.couponUsage.count.mockResolvedValue(0);

      const res = await service.validateCoupon(
        { code: 'WELCOME_NEW', amount: 500 },
        'brand-new-user-id',
      );
      expect(res.valid).toBe(true);
      expect(res.discountAmount).toBe(100);
      expect(res.finalAmount).toBe(400);
    });
  });

  describe('Admin Operations', () => {
    it('should throw ConflictException when creating coupon with duplicate code', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue({
        id: 'existing',
        code: 'DUPLICATE',
      });

      await expect(
        service.createCoupon({
          code: 'duplicate',
          discountType: DiscountType.FLAT,
          discountValue: 50,
          endDate: '2026-12-31',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create coupon successfully', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue(null);
      mockPrisma.coupon.create.mockResolvedValue({
        id: 'c-new',
        code: 'NEWCODE',
        discountValue: 50,
      });

      const res = await service.createCoupon({
        code: 'NEWCODE',
        discountType: DiscountType.FLAT,
        discountValue: 50,
        endDate: '2026-12-31',
      });
      expect(res.message).toBe('Coupon created successfully');
      expect(res.coupon.code).toBe('NEWCODE');
    });
  });
});
