import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from './payments.service';
import { ConfigurablePaymentAdapter } from './adapters/configurable-payment.adapter';
import { PrismaService } from '../database/prisma.service';
import { PaymentStatus, HoldStatus, BookingStatus } from '@prisma/client';

describe('PaymentsService & Payment Abstraction', () => {
  let service: PaymentsService;
  let adapter: ConfigurablePaymentAdapter;
  let prisma: PrismaService;

  const mockConfigService = {
    get: jest.fn().mockImplementation((key: string, defaultVal: any) => {
      if (key === 'payment.provider') return 'mock';
      if (key === 'payment.keyId') return 'test_key_id_123';
      if (key === 'payment.keySecret') return 'test_secret_key_456';
      if (key === 'payment.webhookSecret') return 'test_webhook_secret_789';
      return defaultVal;
    }),
  };

  const mockHold = {
    id: 'hold-1',
    userId: 'user-1',
    turfId: 'turf-1',
    sportId: 'sport-1',
    holdDate: new Date('2026-10-15'),
    startTime: '18:00',
    endTime: '19:00',
    status: HoldStatus.ACTIVE,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    totalPrice: 1600,
  };

  const mockPayment = {
    id: 'pay-1',
    paymentNumber: 'PAY-20261015-ABCD',
    userId: 'user-1',
    slotHoldId: 'hold-1',
    bookingId: null,
    provider: 'MOCK',
    orderId: 'order_mock_12345',
    amount: 1600,
    currency: 'INR',
    status: PaymentStatus.PENDING,
    booking: null,
    slotHold: mockHold,
  };

  const mockPrismaService = {
    payment: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    paymentStatusHistory: {
      create: jest.fn(),
    },
    slotHold: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    booking: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    bookingStatusHistory: {
      create: jest.fn(),
    },
    webhookEvent: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    $executeRaw: jest.fn().mockResolvedValue(1),
    $transaction: jest.fn().mockImplementation((cb) => cb(mockPrismaService)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        ConfigurablePaymentAdapter,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    adapter = module.get<ConfigurablePaymentAdapter>(
      ConfigurablePaymentAdapter,
    );
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(adapter).toBeDefined();
    expect(prisma).toBeDefined();
  });

  describe('Order Creation', () => {
    it('should create payment order from active slot hold', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue(null);
      mockPrismaService.slotHold.findUnique.mockResolvedValue(mockHold);
      mockPrismaService.payment.create.mockResolvedValue(mockPayment);

      const result = await service.createOrder('user-1', {
        holdId: 'hold-1',
      });

      expect(result.paymentId).toBe('pay-1');
      expect(result.amount).toBe(1600);
      expect(result.provider).toBe('MOCK');
      expect(mockPrismaService.paymentStatusHistory.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException if hold not found', async () => {
      mockPrismaService.slotHold.findUnique.mockResolvedValue(null);

      await expect(
        service.createOrder('user-1', { holdId: 'invalid-hold' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Server-Side Cryptographic Payment Verification', () => {
    it('should verify valid HMAC signature server-side and confirm booking', async () => {
      const orderId = 'order_mock_12345';
      const transactionId = 'pay_tx_789';
      const validSignature = adapter.generateTestSignature(
        orderId,
        transactionId,
      );

      mockPrismaService.payment.findFirst.mockResolvedValue(mockPayment);
      mockPrismaService.payment.update.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.SUCCESS,
        transactionId,
        signature: validSignature,
      });
      mockPrismaService.slotHold.findUnique.mockResolvedValue(mockHold);
      mockPrismaService.booking.create.mockResolvedValue({
        id: 'booking-new-1',
        bookingNumber: 'TB-20261015-XYZ',
        status: BookingStatus.CONFIRMED,
      });

      const result = await service.verifyPayment('user-1', {
        orderId,
        transactionId,
        signature: validSignature,
      });

      expect(result.verified).toBe(true);
      expect(result.message).toContain('Payment verified');
      expect(mockPrismaService.booking.create).toHaveBeenCalled();
      expect(mockPrismaService.paymentStatusHistory.create).toHaveBeenCalled();
    });

    it('should reject tampered or invalid signature and fail payment', async () => {
      mockPrismaService.payment.findFirst.mockResolvedValue(mockPayment);

      await expect(
        service.verifyPayment('user-1', {
          orderId: 'order_mock_12345',
          transactionId: 'pay_tx_789',
          signature: 'invalid_tampered_signature_1234567890abcdef',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrismaService.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: PaymentStatus.FAILED,
          }),
        }),
      );
    });
  });

  describe('Webhook Processing & Duplicate Event Handling', () => {
    it('should process webhook payment.captured with valid signature', async () => {
      const payload = {
        event: 'payment.captured',
        orderId: 'order_mock_12345',
        transactionId: 'pay_tx_789',
        amount: 160000,
      };
      const rawBody = JSON.stringify(payload);
      const signature = adapter.generateTestWebhookSignature(rawBody);

      mockPrismaService.webhookEvent.findUnique.mockResolvedValue(null);
      mockPrismaService.payment.findFirst.mockResolvedValue(mockPayment);
      mockPrismaService.slotHold.findUnique.mockResolvedValue(mockHold);
      mockPrismaService.booking.create.mockResolvedValue({ id: 'booking-1' });

      const result = await service.handleWebhook(
        rawBody,
        { 'x-webhook-signature': signature },
        payload,
      );

      expect(result.received).toBe(true);
      expect((result as any).status).toBe('PROCESSED');
      expect(mockPrismaService.webhookEvent.create).toHaveBeenCalled();
    });

    it('should ignore duplicate webhook idempotently', async () => {
      const payload = { id: 'evt_dup_123', event: 'payment.captured' };
      const rawBody = JSON.stringify(payload);
      const signature = adapter.generateTestWebhookSignature(rawBody);

      mockPrismaService.webhookEvent.findUnique.mockResolvedValue({
        id: 'existing-event',
      });

      const result = await service.handleWebhook(
        rawBody,
        { 'x-webhook-signature': signature },
        payload,
      );

      expect(result.received).toBe(true);
      expect((result as any).duplicate).toBe(true);
      expect(mockPrismaService.webhookEvent.create).not.toHaveBeenCalled();
    });

    it('should reject webhook with invalid signature', async () => {
      const rawBody = JSON.stringify({ event: 'payment.captured' });

      await expect(
        service.handleWebhook(
          rawBody,
          { 'x-webhook-signature': 'bad_signature' },
          {},
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
