import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../database/prisma.service';
import { AvailabilityService } from '../availability/availability.service';
import { ConfigurablePaymentAdapter } from '../payments/adapters/configurable-payment.adapter';
import { BookingStatus, HoldStatus, PaymentStatus } from '@prisma/client';
import { PaymentMethodType } from './dto/complete-payment.dto';

describe('Advance Booking & Balance Payment Completion', () => {
  let bookingsService: BookingsService;
  let paymentsService: PaymentsService;
  let prisma: any;

  const mockTurf = {
    id: 'turf-advance-1',
    name: 'Premier Arena',
    isActive: true,
    advancePaymentAllowed: true,
    minAdvancePercentage: 20, // 20%
    minAdvanceAmount: 200,    // ₹200 min floor
    operatingHours: [
      {
        dayOfWeek: 1, // Monday
        openTime: '06:00',
        closeTime: '23:00',
        isClosed: false,
      },
    ],
    blockedSlots: [],
    owner: { userId: 'owner-1' },
  };

  const mockPrismaService = {
    turf: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    slotHold: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    booking: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    bookingStatusHistory: {
      create: jest.fn(),
    },
    payment: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    paymentStatusHistory: {
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
          endTime: '20:00',
          price: 2000,
          isAvailable: true,
        },
      ],
    }),
  };

  const mockPaymentAdapter = {
    providerName: 'MOCK',
    createOrder: jest.fn().mockResolvedValue({
      orderId: 'order_mock_adv_123',
      amount: 400,
      currency: 'INR',
      keyId: 'mock_key',
      provider: 'MOCK',
    }),
    verifyPayment: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma = mockPrismaService;
    mockPrismaService.slotHold.findMany.mockResolvedValue([]);
    mockPrismaService.booking.findMany.mockResolvedValue([]);
    mockPrismaService.turf.findFirst.mockResolvedValue(mockTurf);
    mockPrismaService.turf.findUnique.mockResolvedValue(mockTurf);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        PaymentsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AvailabilityService, useValue: mockAvailabilityService },
        { provide: ConfigurablePaymentAdapter, useValue: mockPaymentAdapter },
      ],
    }).compile();

    bookingsService = module.get<BookingsService>(BookingsService);
    paymentsService = module.get<PaymentsService>(PaymentsService);
  });

  describe('1. Hold Creation with Advance Booking', () => {
    it('should calculate minimum advance payment (20% of ₹2000 = ₹400)', async () => {
      mockPrismaService.slotHold.create.mockImplementation(({ data }) => ({
        id: 'hold-adv-1',
        ...data,
      }));

      const result: any = await bookingsService.createHold('user-1', {
        turfId: 'turf-advance-1',
        holdDate: '2026-09-28',
        startTime: '18:00',
        endTime: '20:00',
        isAdvance: true,
      });

      expect(result.advancePayment).toBeDefined();
      expect(result.advancePayment.isAdvanceHold).toBe(true);
      expect(result.advancePayment.advanceAmount).toBe(400); // 20% of 2000
      expect(result.advancePayment.minAdvanceAmount).toBe(400);
      expect(result.advancePayment.remainingAmount).toBe(1600);
      expect(mockPrismaService.slotHold.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isAdvanceHold: true,
            advanceAmount: 400,
            minAdvanceAmount: 400,
          }),
        }),
      );
    });

    it('should reject advance payment when amount is below minimum required', async () => {
      await expect(
        bookingsService.createHold('user-1', {
          turfId: 'turf-advance-1',
          holdDate: '2026-09-28',
          startTime: '18:00',
          endTime: '20:00',
          isAdvance: true,
          advanceAmount: 100, // Less than ₹400 min required
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject advance booking when turf venue disallows it', async () => {
      mockPrismaService.turf.findFirst.mockResolvedValue({
        ...mockTurf,
        advancePaymentAllowed: false,
      });

      await expect(
        bookingsService.createHold('user-1', {
          turfId: 'turf-advance-1',
          holdDate: '2026-09-28',
          startTime: '18:00',
          endTime: '20:00',
          isAdvance: true,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('2. Calculate Quote with Advance Payment Breakdown', () => {
    it('should return advance payment breakdown in price quote', async () => {
      const quote = await bookingsService.calculateQuote('user-1', {
        turfId: 'turf-advance-1',
        date: '2026-09-28',
        startTime: '18:00',
        endTime: '20:00',
      });

      expect(quote.advancePayment).toBeDefined();
      expect(quote.advancePayment.advanceAllowed).toBe(true);
      expect(quote.advancePayment.minAdvancePercentage).toBe(20);
      expect(quote.advancePayment.calculatedMinAdvance).toBeGreaterThan(0);
      expect(quote.advancePayment.remainingAmount).toBeGreaterThan(0);
      expect(
        quote.advancePayment.calculatedMinAdvance +
          quote.advancePayment.remainingAmount,
      ).toBe(quote.feeBreakdown.totalAmount);
    });
  });

  describe('3. Order Creation & Verification for Advance Payment', () => {
    const mockAdvanceHold = {
      id: 'hold-adv-1',
      userId: 'user-1',
      turfId: 'turf-advance-1',
      holdDate: new Date('2026-09-28'),
      startTime: '18:00',
      endTime: '20:00',
      totalPrice: 2000,
      status: HoldStatus.ACTIVE,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      isAdvanceHold: true,
      advanceAmount: 500,
      minAdvanceAmount: 400,
      turf: mockTurf,
    };

    it('should create order for the advance amount (₹500)', async () => {
      mockPrismaService.slotHold.findUnique.mockResolvedValue(mockAdvanceHold);
      mockPrismaService.payment.create.mockImplementation(({ data }) => ({
        id: 'payment-adv-1',
        ...data,
      }));

      const order = await paymentsService.createOrder('user-1', {
        holdId: 'hold-adv-1',
        isAdvance: true,
        advanceAmount: 500,
      });

      expect(mockPaymentAdapter.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 500,
        }),
      );
      expect(mockPrismaService.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amount: 500,
            paymentType: 'ADVANCE',
          }),
        }),
      );
      expect(order).toBeDefined();
    });

    it('should verify advance payment and confirm booking with PARTIALLY_PAID status and remaining balance', async () => {
      const mockPendingPayment = {
        id: 'payment-adv-1',
        paymentNumber: 'PAY-111',
        userId: 'user-1',
        slotHoldId: 'hold-adv-1',
        orderId: 'order_mock_adv_123',
        amount: 500,
        status: PaymentStatus.PENDING,
        paymentType: 'ADVANCE',
      };

      mockPrismaService.payment.findFirst.mockResolvedValue(mockPendingPayment);
      mockPrismaService.payment.update.mockResolvedValue({
        ...mockPendingPayment,
        status: PaymentStatus.SUCCESS,
      });
      mockPrismaService.slotHold.findUnique.mockResolvedValue(mockAdvanceHold);
      mockPrismaService.booking.create.mockImplementation(({ data }) => ({
        id: 'booking-adv-1',
        ...data,
      }));

      const verifyResult = await paymentsService.verifyPayment('user-1', {
        orderId: 'order_mock_adv_123',
        transactionId: 'txn-adv-999',
        signature: 'valid_sig',
      });

      expect(verifyResult.verified).toBe(true);
      expect(mockPrismaService.booking.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: BookingStatus.CONFIRMED,
            isAdvanceBooking: true,
            advanceAmount: 500,
            paidAmount: 500,
            remainingAmount: 1500, // 2000 - 500
            paymentStatus: 'PARTIALLY_PAID',
          }),
        }),
      );
    });
  });

  describe('4. Later Payment Completion for Remaining Balance', () => {
    const mockAdvanceBooking = {
      id: 'booking-adv-1',
      bookingNumber: 'TB-ADV-123',
      userId: 'user-1',
      turfId: 'turf-advance-1',
      bookingDate: new Date('2026-09-28'),
      startTime: '18:00',
      endTime: '20:00',
      totalPrice: 2000,
      paidAmount: 500,
      remainingAmount: 1500,
      isAdvanceBooking: true,
      paymentStatus: 'PARTIALLY_PAID',
      status: BookingStatus.CONFIRMED,
      turf: mockTurf,
      payments: [],
    };

    it('should create payment order for the remaining amount (₹1500)', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValue(mockAdvanceBooking);
      mockPrismaService.payment.create.mockImplementation(({ data }) => ({
        id: 'payment-bal-1',
        ...data,
      }));

      await paymentsService.createOrder('user-1', {
        bookingId: 'booking-adv-1',
      });

      expect(mockPaymentAdapter.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 1500, // Remaining balance
        }),
      );
      expect(mockPrismaService.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amount: 1500,
            paymentType: 'BALANCE',
          }),
        }),
      );
    });

    it('should reject payment order if booking is already fully paid', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValue({
        ...mockAdvanceBooking,
        remainingAmount: 0,
        paidAmount: 2000,
        paymentStatus: 'PAID',
      });

      await expect(
        paymentsService.createOrder('user-1', {
          bookingId: 'booking-adv-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should verify balance payment and update booking to fully PAID with zero remaining balance', async () => {
      const mockBalancePayment = {
        id: 'payment-bal-1',
        paymentNumber: 'PAY-BAL-222',
        userId: 'user-1',
        bookingId: 'booking-adv-1',
        orderId: 'order_bal_123',
        amount: 1500,
        status: PaymentStatus.PENDING,
        paymentType: 'BALANCE',
      };

      mockPrismaService.payment.findFirst.mockResolvedValue(mockBalancePayment);
      mockPrismaService.payment.update.mockResolvedValue({
        ...mockBalancePayment,
        status: PaymentStatus.SUCCESS,
      });
      mockPrismaService.booking.findUnique.mockResolvedValue(mockAdvanceBooking);
      mockPrismaService.booking.update.mockImplementation(({ data }) => ({
        ...mockAdvanceBooking,
        ...data,
      }));

      const verifyResult = await paymentsService.verifyPayment('user-1', {
        orderId: 'order_bal_123',
        transactionId: 'txn-bal-888',
        signature: 'valid_sig',
      });

      expect(verifyResult.verified).toBe(true);
      expect(mockPrismaService.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            paidAmount: 2000, // 500 + 1500
            remainingAmount: 0,
            paymentStatus: 'PAID',
          }),
        }),
      );
    });

    it('should complete remaining balance offline (CASH/UPI) directly via completePayment endpoint', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValue(mockAdvanceBooking);
      mockPrismaService.payment.create.mockImplementation(({ data }) => ({
        id: 'payment-offline-1',
        ...data,
      }));
      mockPrismaService.booking.update.mockImplementation(({ data }) => ({
        ...mockAdvanceBooking,
        ...data,
      }));

      const settleResult: any = await bookingsService.completePayment(
        'user-1',
        ['CUSTOMER'],
        'booking-adv-1',
        {
          paymentMethod: PaymentMethodType.CASH,
          amount: 1500,
          transactionReference: 'CASH-REC-101',
          notes: 'Customer settled remaining cash at venue desk',
        },
      );

      expect(settleResult.success).toBe(true);
      expect(settleResult.booking.paidAmount).toBe(2000);
      expect(settleResult.booking.remainingAmount).toBe(0);
      expect(settleResult.booking.paymentStatus).toBe('PAID');
      expect(mockPrismaService.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            paymentType: 'BALANCE',
            provider: PaymentMethodType.CASH,
            amount: 1500,
            status: PaymentStatus.SUCCESS,
          }),
        }),
      );
    });
  });
});
