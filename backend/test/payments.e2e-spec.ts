import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { Role } from '../src/common/enums/role.enum';
import { ConfigurablePaymentAdapter } from '../src/payments/adapters/configurable-payment.adapter';
import { PrismaService } from '../src/database/prisma.service';

describe('Payment Abstraction & Webhooks (e2e)', () => {
  let app: INestApplication;
  let adapter: ConfigurablePaymentAdapter;
  let prisma: PrismaService;

  const timestamp = Date.now();
  let customerToken: string;
  let ownerToken: string;
  let turfId: string;
  let cityId: string;
  let holdId: string;
  let orderId: string;
  let paymentId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1', {
      exclude: ['health', 'health/db'],
    });
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
    adapter = app.get<ConfigurablePaymentAdapter>(ConfigurablePaymentAdapter);
    prisma = app.get<PrismaService>(PrismaService);

    // 1. Register Owner
    const ownerRes = await request
      .default(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Turf Owner Pedro',
        email: `pedro_${timestamp}@test.com`,
        password: 'Password123!',
        role: Role.TURF_OWNER,
      });
    ownerToken = ownerRes.body.data.accessToken;

    // 2. Register Customer
    const custRes = await request
      .default(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Player Dennis',
        email: `dennis_${timestamp}@test.com`,
        password: 'Password123!',
        role: Role.CUSTOMER,
      });
    customerToken = custRes.body.data.accessToken;

    // 3. Discover City
    const turfsList = await request
      .default(app.getHttpServer())
      .get('/api/v1/turfs');
    if (turfsList.body.data && turfsList.body.data.items.length > 0) {
      cityId = turfsList.body.data.items[0].cityId;
    }

    // 4. Create Turf for Payment Tests
    const turfRes = await request
      .default(app.getHttpServer())
      .post('/api/v1/owner/turfs')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: `Titanium Turf ${timestamp}`,
        cityId,
        addressLine: '88 Payment Way',
        contactPhone: '+919988112233',
        contactEmail: 'contact@titaniumturf.com',
        operatingHours: [
          {
            dayOfWeek: 0,
            openTime: '06:00',
            closeTime: '23:00',
            isClosed: false,
          },
          {
            dayOfWeek: 1,
            openTime: '06:00',
            closeTime: '23:00',
            isClosed: false,
          },
          {
            dayOfWeek: 2,
            openTime: '06:00',
            closeTime: '23:00',
            isClosed: false,
          },
          {
            dayOfWeek: 3,
            openTime: '06:00',
            closeTime: '23:00',
            isClosed: false,
          },
          {
            dayOfWeek: 4,
            openTime: '06:00',
            closeTime: '23:00',
            isClosed: false,
          },
          {
            dayOfWeek: 5,
            openTime: '06:00',
            closeTime: '23:00',
            isClosed: false,
          },
          {
            dayOfWeek: 6,
            openTime: '06:00',
            closeTime: '23:00',
            isClosed: false,
          },
        ],
        pricingRules: [
          {
            ruleName: 'Standard Rate',
            dayType: 'ALL',
            startTime: '06:00',
            endTime: '23:00',
            hourlyPrice: 1400,
          },
        ],
      });

    turfId = turfRes.body.data.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Payment Order Creation & Server-Side Verification', () => {
    it('Step 1: Create slot hold -> Step 2: POST /api/v1/payments/create-order', async () => {
      // 1. Create Hold
      const holdRes = await request
        .default(app.getHttpServer())
        .post('/api/v1/booking/holds')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          turfId,
          holdDate: '2026-10-20',
          startTime: '15:00',
          endTime: '16:00',
        })
        .expect(201);

      holdId = holdRes.body.data.id;

      // 2. Create Order
      const orderRes = await request
        .default(app.getHttpServer())
        .post('/api/v1/payments/create-order')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          holdId,
          idempotencyKey: `idem_pay_ord_${timestamp}`,
        })
        .expect(201);

      expect(orderRes.body.success).toBe(true);
      expect(orderRes.body.data.orderId).toBeDefined();
      expect(orderRes.body.data.amount).toBe(1400);
      expect(orderRes.body.data.currency).toBe('INR');
      expect(orderRes.body.data.provider).toBeDefined();
      expect(orderRes.body.data.keyId).toBeDefined();

      orderId = orderRes.body.data.orderId;
      paymentId = orderRes.body.data.paymentId;
    });

    it('GET /api/v1/payments/:id/status -> retrieve lightweight payment status', async () => {
      const res = await request
        .default(app.getHttpServer())
        .get(`/api/v1/payments/${paymentId}/status`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('PENDING');
      expect(res.body.data.amount).toBe(1400);
    });

    it('POST /api/v1/payments/verify -> MUST REJECT invalid or tampered signature (no Flutter-only confirmation)', async () => {
      const res = await request
        .default(app.getHttpServer())
        .post('/api/v1/payments/verify')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          orderId,
          transactionId: 'pay_tampered_123',
          signature: 'fake_tampered_signature_from_client_callback',
        })
        .expect(400);

      expect(res.body.statusCode).toBe(400);

      // Verify that NO confirmed booking was created!
      const activeBooking = await prisma.booking.findFirst({
        where: {
          turfId,
          bookingDate: new Date('2026-10-20'),
          startTime: '15:00',
          status: 'CONFIRMED',
        },
      });
      expect(activeBooking).toBeNull();
    });

    it('POST /api/v1/payments/verify -> MUST SUCCEED with valid cryptographic signature and confirm booking', async () => {
      const transactionId = `pay_tx_${Date.now()}`;
      const validSignature = adapter.generateTestSignature(
        orderId,
        transactionId,
      );

      const res = await request
        .default(app.getHttpServer())
        .post('/api/v1/payments/verify')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          orderId,
          transactionId,
          signature: validSignature,
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.verified).toBe(true);
      expect(res.body.data.payment.status).toBe('SUCCESS');
      expect(res.body.data.booking).toBeDefined();
      expect(res.body.data.booking.status).toBe('CONFIRMED');

      // Verify at the database level that booking is CONFIRMED with activeSlotKey
      const dbBooking = await prisma.booking.findUnique({
        where: { id: res.body.data.booking.id },
      });
      expect(dbBooking).not.toBeNull();
      expect(dbBooking?.activeSlotKey).toBe(`${turfId}_2026-10-20_15:00`);
    });

    it('GET /api/v1/payments/:id -> get full payment details with audit history', async () => {
      const res = await request
        .default(app.getHttpServer())
        .get(`/api/v1/payments/${paymentId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(paymentId);
      expect(res.body.data.status).toBe('SUCCESS');
      expect(res.body.data.statusHistory.length).toBeGreaterThanOrEqual(2);
      const statuses = res.body.data.statusHistory.map((h: any) => h.toStatus);
      expect(statuses).toContain('PENDING');
      expect(statuses).toContain('SUCCESS');
    });
  });

  describe('Payment Gateway Webhook Handling', () => {
    let webhookOrderId: string;
    let webhookPaymentId: string;
    let webhookHoldId: string;

    beforeAll(async () => {
      // Create a fresh hold and order for webhook testing
      const holdRes = await request
        .default(app.getHttpServer())
        .post('/api/v1/booking/holds')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          turfId,
          holdDate: '2026-10-21',
          startTime: '17:00',
          endTime: '18:00',
        });

      webhookHoldId = holdRes.body.data.id;

      const orderRes = await request
        .default(app.getHttpServer())
        .post('/api/v1/payments/create-order')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ holdId: webhookHoldId });

      webhookOrderId = orderRes.body.data.orderId;
      webhookPaymentId = orderRes.body.data.paymentId;
    });

    it('POST /api/v1/webhooks/payment -> reject webhook with invalid signature', async () => {
      const body = { event: 'payment.captured', orderId: webhookOrderId };

      const res = await request
        .default(app.getHttpServer())
        .post('/api/v1/webhooks/payment')
        .set('x-webhook-signature', 'invalid_signature_hex')
        .send(body)
        .expect(400);

      expect(res.body.statusCode).toBe(400);
    });

    it('POST /api/v1/webhooks/payment -> process valid payment.captured webhook and confirm booking', async () => {
      const eventId = `evt_webhook_test_${Date.now()}`;
      const transactionId = `pay_webhook_tx_${Date.now()}`;
      const payload = {
        id: eventId,
        event: 'payment.captured',
        orderId: webhookOrderId,
        transactionId,
        amount: 140000,
      };
      const rawBody = JSON.stringify(payload);
      const signature = adapter.generateTestWebhookSignature(rawBody);

      const res = await request
        .default(app.getHttpServer())
        .post('/api/v1/webhooks/payment')
        .set('x-webhook-signature', signature)
        .send(payload)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.received).toBe(true);
      expect(res.body.data.status).toBe('PROCESSED');

      // Verify payment transitioned to SUCCESS in database
      const dbPayment = await prisma.payment.findUnique({
        where: { id: webhookPaymentId },
      });
      expect(dbPayment?.status).toBe('SUCCESS');

      // Verify booking was confirmed
      const dbBooking = await prisma.booking.findFirst({
        where: {
          turfId,
          bookingDate: new Date('2026-10-21'),
          startTime: '17:00',
          status: 'CONFIRMED',
        },
      });
      expect(dbBooking).not.toBeNull();
    });

    it('POST /api/v1/webhooks/payment -> DUPLICATE webhook handling must be idempotent', async () => {
      // Re-send the exact same payload
      const eventId = `evt_dup_test_${Date.now()}`;
      const payload = {
        id: eventId,
        event: 'payment.captured',
        orderId: webhookOrderId,
      };
      const rawBody = JSON.stringify(payload);
      const signature = adapter.generateTestWebhookSignature(rawBody);

      // 1. First send
      await request
        .default(app.getHttpServer())
        .post('/api/v1/webhooks/payment')
        .set('x-webhook-signature', signature)
        .send(payload)
        .expect(200);

      // 2. Duplicate send (retry from gateway)
      const resDup = await request
        .default(app.getHttpServer())
        .post('/api/v1/webhooks/payment')
        .set('x-webhook-signature', signature)
        .send(payload)
        .expect(200);

      expect(resDup.body.success).toBe(true);
      expect(resDup.body.data.received).toBe(true);
      expect(resDup.body.data.duplicate).toBe(true);
    });
  });
});
