import { Test, TestingModule } from '@nestjs/testing';
import { RefundsService } from './refunds.service';
import { PrismaService } from '../database/prisma.service';
import { ConfigurablePaymentAdapter } from '../payments/adapters/configurable-payment.adapter';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  PaymentStatus,
  RefundStatus,
  RefundType,
} from '@prisma/client';
import { DEFAULT_CANCELLATION_POLICY } from './interfaces/cancellation-policy.interface';

describe('RefundsService', () => {
  let service: RefundsService;
  let prisma: any;
  let paymentAdapter: any;

  const mockTurfId = 'turf-uuid-1';
  const mockBookingId = 'booking-uuid-1';
  const mockUserId = 'user-uuid-customer';
  const mockOwnerUserId = 'user-uuid-owner';

  const mockTurf = {
    id: mockTurfId,
    name: 'Champions Arena',
    cancellationPolicy: 'Custom policy string',
    owner: {
      userId: mockOwnerUserId,
    },
    cancellationPolicyRule: null,
  };

  const mockBooking = {
    id: mockBookingId,
    bookingNumber: 'TB-20261020-001',
    userId: mockUserId,
    turfId: mockTurfId,
    bookingDate: new Date('2026-10-20'),
    startTime: '16:00',
    endTime: '17:00',
    totalPrice: 1400,
    status: BookingStatus.CONFIRMED,
    activeSlotKey: 'slot_key_1',
    turf: mockTurf,
    payments: [
      {
        id: 'payment-1',
        amount: 1400,
        status: PaymentStatus.SUCCESS,
        orderId: 'order_1',
        transactionId: 'pay_tx_1',
      },
    ],
    refunds: [],
  };

  beforeEach(async () => {
    prisma = {
      turf: {
        findUnique: jest.fn(),
      },
      booking: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      bookingStatusHistory: {
        create: jest.fn(),
      },
      refund: {
        create: jest.fn(),
        findUnique: jest.fn(),
      },
      payment: {
        update: jest.fn(),
      },
      paymentStatusHistory: {
        create: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(prisma)),
    };

    paymentAdapter = {
      processRefund: jest.fn().mockResolvedValue({
        gatewayRefundId: 'rfnd_gw_123',
        status: 'COMPLETED',
        amount: 1400,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefundsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigurablePaymentAdapter, useValue: paymentAdapter },
      ],
    }).compile();

    service = module.get<RefundsService>(RefundsService);
  });

  describe('Policy Retrieval (GET /api/v1/turfs/:id/cancellation-policy)', () => {
    it('should return default cancellation policy when no custom rule exists', async () => {
      prisma.turf.findUnique.mockResolvedValue(mockTurf);

      const policy = await service.getTurfCancellationPolicy(mockTurfId);
      expect(policy.turfId).toBe(mockTurfId);
      expect(policy.freeCancellationHours).toBe(24);
      expect(policy.rules.length).toBeGreaterThanOrEqual(4);
    });

    it('should return custom cancellation policy when configured on turf', async () => {
      prisma.turf.findUnique.mockResolvedValue({
        ...mockTurf,
        cancellationPolicyRule: {
          freeCancellationHours: 48,
          fixedCancellationFee: 150,
          rules: [{ minHoursBefore: 48, refundPercentage: 100, fixedFee: 0 }],
          description: 'Strict 48h policy',
        },
      });

      const policy = await service.getTurfCancellationPolicy(mockTurfId);
      expect(policy.freeCancellationHours).toBe(48);
      expect(policy.fixedCancellationFee).toBe(150);
      expect(policy.description).toBe('Strict 48h policy');
    });

    it('should throw NotFoundException if turf does not exist', async () => {
      prisma.turf.findUnique.mockResolvedValue(null);
      await expect(
        service.getTurfCancellationPolicy('non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Server-Side Cancellation & Refund Calculations', () => {
    it('should calculate 100% full refund when cancelled >= 24h prior', () => {
      const calc = service.calculateCancellationValues(
        1400,
        1400,
        30, // 30 hours remaining (> 24h)
        DEFAULT_CANCELLATION_POLICY,
      );

      expect(calc.refundType).toBe(RefundType.FULL);
      expect(calc.refundPercentage).toBe(100);
      expect(calc.cancellationFee).toBe(0);
      expect(calc.refundAmount).toBe(1400);
      expect(calc.isEligibleForRefund).toBe(true);
    });

    it('should calculate 75% partial refund when cancelled 18h prior (between 12h and 24h)', () => {
      const calc = service.calculateCancellationValues(
        1400,
        1400,
        18, // 18 hours remaining
        DEFAULT_CANCELLATION_POLICY,
      );

      expect(calc.refundType).toBe(RefundType.PARTIAL);
      expect(calc.refundPercentage).toBe(75);
      expect(calc.cancellationFee).toBe(350); // 25% fee
      expect(calc.refundAmount).toBe(1050);
      expect(calc.isEligibleForRefund).toBe(true);
    });

    it('should calculate 50% refund minus ₹100 fixed fee when cancelled 6h prior (between 4h and 12h)', () => {
      const calc = service.calculateCancellationValues(
        1400,
        1400,
        6, // 6 hours remaining
        DEFAULT_CANCELLATION_POLICY,
      );

      expect(calc.refundType).toBe(RefundType.PARTIAL);
      expect(calc.refundPercentage).toBe(50);
      // 50% of 1400 = 700 minus 100 fee = 600 refund, cancellationFee = 800
      expect(calc.refundAmount).toBe(600);
      expect(calc.cancellationFee).toBe(800);
    });

    it('should calculate 0% NO_REFUND when cancelled 2h prior (< 4h tier)', () => {
      const calc = service.calculateCancellationValues(
        1400,
        1400,
        2, // 2 hours remaining
        DEFAULT_CANCELLATION_POLICY,
      );

      expect(calc.refundType).toBe(RefundType.NONE);
      expect(calc.refundPercentage).toBe(0);
      expect(calc.cancellationFee).toBe(1400);
      expect(calc.refundAmount).toBe(0);
      expect(calc.isEligibleForRefund).toBe(false);
    });

    it('should calculate 0 refund for unpaid bookings', () => {
      const calc = service.calculateCancellationValues(
        1400,
        0, // Unpaid
        30,
        DEFAULT_CANCELLATION_POLICY,
      );

      expect(calc.refundType).toBe(RefundType.NONE);
      expect(calc.refundAmount).toBe(0);
      expect(calc.cancellationFee).toBe(0);
      expect(calc.isEligibleForRefund).toBe(false);
    });
  });

  describe('GET /api/v1/bookings/:id/cancellation-fee', () => {
    it('should return cancellation fee details for authorized customer', async () => {
      prisma.booking.findUnique.mockResolvedValue(mockBooking);
      prisma.turf.findUnique.mockResolvedValue(mockTurf);

      // Slot is at 2026-10-20 16:00. Simulate reference time at 2026-10-20 10:00 (6h prior -> 50% minus 100 = 600 refund)
      const refTime = new Date('2026-10-20T10:00:00');
      const result = await service.calculateCancellationFee(
        mockUserId,
        ['CUSTOMER'],
        mockBookingId,
        refTime,
      );

      expect(result.bookingId).toBe(mockBookingId);
      expect(result.totalPrice).toBe(1400);
      expect(result.amountPaid).toBe(1400);
      expect(result.hoursRemaining).toBe(6);
      expect(result.cancellationFee).toBe(800);
      expect(result.refundAmount).toBe(600);
      expect(result.refundType).toBe(RefundType.PARTIAL);
    });

    it('should throw ForbiddenException if another customer tries to check fee', async () => {
      prisma.booking.findUnique.mockResolvedValue(mockBooking);

      await expect(
        service.calculateCancellationFee(
          'intruder-user',
          ['CUSTOMER'],
          mockBookingId,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('GET /api/v1/bookings/:id/refund-preview', () => {
    it('should return financial breakdown preview', async () => {
      prisma.booking.findUnique.mockResolvedValue(mockBooking);
      prisma.turf.findUnique.mockResolvedValue(mockTurf);

      const refTime = new Date('2026-10-18T10:00:00'); // > 48h prior -> full refund
      const preview = await service.getRefundPreview(
        mockUserId,
        ['CUSTOMER'],
        mockBookingId,
        refTime,
      );

      expect(preview.bookingId).toBe(mockBookingId);
      expect(preview.financials.amountPaid).toBe(1400);
      expect(preview.financials.estimatedRefundAmount).toBe(1400);
      expect(preview.financials.refundType).toBe(RefundType.FULL);
      expect(preview.financials.isEligibleForRefund).toBe(true);
    });
  });

  describe('POST /api/v1/bookings/:id/cancel (with server-side refund)', () => {
    it('should cancel booking, release slot, and process full refund', async () => {
      prisma.booking.findUnique.mockResolvedValue(mockBooking);
      prisma.turf.findUnique.mockResolvedValue(mockTurf);
      prisma.booking.update.mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.REFUNDED,
        activeSlotKey: null,
      });
      prisma.refund.create.mockResolvedValue({
        id: 'refund-1',
        refundNumber: 'RFND-12345678',
        amount: 1400,
        status: RefundStatus.COMPLETED,
      });

      const refTime = new Date('2026-10-18T10:00:00'); // > 24h prior -> full refund
      const result = await service.cancelBookingWithRefund(
        mockUserId,
        ['CUSTOMER'],
        mockBookingId,
        { reason: 'Customer change of plans' },
        refTime,
      );

      expect(prisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockBookingId },
          data: expect.objectContaining({
            status: BookingStatus.REFUNDED,
            activeSlotKey: null,
          }),
        }),
      );
      expect(paymentAdapter.processRefund).toHaveBeenCalledWith(
        expect.objectContaining({
          transactionId: 'pay_tx_1',
          amount: 1400,
        }),
      );
      expect(result.cancellation.refundType).toBe(RefundType.FULL);
      expect(result.cancellation.refundAmount).toBe(1400);
    });

    it('should reject cancellation of already cancelled booking', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.CANCELLED,
      });

      await expect(
        service.cancelBookingWithRefund(
          mockUserId,
          ['CUSTOMER'],
          mockBookingId,
          { reason: 'Again' },
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('POST /api/v1/refunds (Manual / Admin refund)', () => {
    it('should process manual refund when executed by admin', async () => {
      prisma.booking.findUnique.mockResolvedValue(mockBooking);
      prisma.turf.findUnique.mockResolvedValue(mockTurf);
      prisma.refund.create.mockResolvedValue({
        id: 'refund-manual-1',
        amount: 500,
        status: RefundStatus.COMPLETED,
        refundType: RefundType.PARTIAL,
      });

      const refund = await service.createRefund('admin-user', ['ADMIN'], {
        bookingId: mockBookingId,
        amount: 500,
        reason: 'Customer goodwill partial refund',
      });

      expect(paymentAdapter.processRefund).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 500,
          transactionId: 'pay_tx_1',
        }),
      );
      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: PaymentStatus.PARTIALLY_REFUNDED },
        }),
      );
      expect(refund.status).toBe(RefundStatus.COMPLETED);
    });

    it('should reject refund when amount exceeds total paid', async () => {
      prisma.booking.findUnique.mockResolvedValue(mockBooking);

      await expect(
        service.createRefund('admin-user', ['ADMIN'], {
          bookingId: mockBookingId,
          amount: 2000, // Exceeds 1400
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject refund if requested by regular customer without authorization', async () => {
      prisma.booking.findUnique.mockResolvedValue(mockBooking);

      await expect(
        service.createRefund(mockUserId, ['CUSTOMER'], {
          bookingId: mockBookingId,
          amount: 500,
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('GET /api/v1/refunds/:id', () => {
    it('should return refund details for authorized customer', async () => {
      prisma.refund.findUnique.mockResolvedValue({
        id: 'refund-1',
        userId: mockUserId,
        amount: 1400,
        status: RefundStatus.COMPLETED,
        booking: {
          turf: {
            owner: {
              userId: mockOwnerUserId,
            },
          },
        },
      });

      const refund = await service.getRefundById(
        mockUserId,
        ['CUSTOMER'],
        'refund-1',
      );
      expect(refund.id).toBe('refund-1');
      expect(refund.amount).toBe(1400);
    });

    it('should throw ForbiddenException if another customer accesses the refund', async () => {
      prisma.refund.findUnique.mockResolvedValue({
        id: 'refund-1',
        userId: mockUserId,
        booking: {
          turf: {
            owner: {
              userId: mockOwnerUserId,
            },
          },
        },
      });

      await expect(
        service.getRefundById('intruder-user', ['CUSTOMER'], 'refund-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
