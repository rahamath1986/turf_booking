import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { Role } from '../src/common/enums/role.enum';
import { ConfigurablePaymentAdapter } from '../src/payments/adapters/configurable-payment.adapter';
import { PrismaService } from '../src/database/prisma.service';

describe('Cancellation & Refunds Subsystem (e2e)', () => {
  let app: INestApplication;
  let adapter: ConfigurablePaymentAdapter;
  let prisma: PrismaService;

  const timestamp = Date.now();
  let adminToken: string;
  let ownerToken: string;
  let customer1Token: string;
  let customer2Token: string;

  let turfId: string;
  let cityId: string;
  let bookingId: string;
  let paymentId: string;
  let refundId: string;

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

    // 1. Login as Admin / Super Admin
    const adminLoginRes = await request
      .default(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'superadmin.demo@turfplatform.test',
        password: 'TestSecurePass#2026',
      });
    adminToken = adminLoginRes.body.data.accessToken;

    // 2. Register Turf Owner
    const ownerRes = await request
      .default(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Owner Oscar',
        email: `owner_${timestamp}@test.com`,
        password: 'Password123!',
        role: Role.TURF_OWNER,
      });
    ownerToken = ownerRes.body.data.accessToken;

    // 3. Register Customer 1
    const cust1Res = await request
      .default(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Customer Charlie',
        email: `charlie_${timestamp}@test.com`,
        password: 'Password123!',
        role: Role.CUSTOMER,
      });
    customer1Token = cust1Res.body.data.accessToken;

    // 4. Register Customer 2 (for authorization tests)
    const cust2Res = await request
      .default(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Customer Dave',
        email: `dave_${timestamp}@test.com`,
        password: 'Password123!',
        role: Role.CUSTOMER,
      });
    customer2Token = cust2Res.body.data.accessToken;

    // 5. Discover a valid city
    const turfsList = await request
      .default(app.getHttpServer())
      .get('/api/v1/turfs');
    if (turfsList.body.data && turfsList.body.data.items.length > 0) {
      cityId = turfsList.body.data.items[0].cityId;
    }

    // 6. Create Turf with Pricing Rules
    const turfRes = await request
      .default(app.getHttpServer())
      .post('/api/v1/owner/turfs')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: `Galaxy Turf ${timestamp}`,
        cityId,
        addressLine: '99 Cancellation Boulevard',
        contactPhone: '+919911223344',
        contactEmail: 'contact@galaxyturf.com',
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

  describe('Turf Cancellation Policy API', () => {
    it('GET /api/v1/turfs/:id/cancellation-policy -> retrieve default platform tiered cancellation policy', async () => {
      const res = await request
        .default(app.getHttpServer())
        .get(`/api/v1/turfs/${turfId}/cancellation-policy`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.turfId).toBe(turfId);
      expect(res.body.data.freeCancellationHours).toBe(24);
      expect(Array.isArray(res.body.data.rules)).toBe(true);
      expect(res.body.data.rules.length).toBeGreaterThanOrEqual(4);

      // Verify tiers include 100% full refund and 0% no refund
      const percentages = res.body.data.rules.map(
        (r: any) => r.refundPercentage,
      );
      expect(percentages).toContain(100);
      expect(percentages).toContain(0);
    });

    it('GET /api/v1/turfs/:id/cancellation-policy -> return 404 for non-existent turf', async () => {
      const res = await request
        .default(app.getHttpServer())
        .get(
          '/api/v1/turfs/00000000-0000-0000-0000-000000000000/cancellation-policy',
        )
        .expect(404);

      expect(res.body.statusCode).toBe(404);
    });
  });

  describe('Booking Creation & Payment Confirmation for Cancellation Tests', () => {
    it('Create slot hold, create payment order, and verify payment to establish CONFIRMED paid booking', async () => {
      // 1. Hold slot far in the future (> 24 hours) for 100% refund testing
      const holdRes = await request
        .default(app.getHttpServer())
        .post('/api/v1/booking/holds')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({
          turfId,
          holdDate: '2026-11-20',
          startTime: '18:00',
          endTime: '19:00',
        })
        .expect(201);

      const holdId = holdRes.body.data.id;

      // 2. Create payment order
      const orderRes = await request
        .default(app.getHttpServer())
        .post('/api/v1/payments/create-order')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({ holdId })
        .expect(201);

      const orderId = orderRes.body.data.orderId;
      paymentId = orderRes.body.data.paymentId;

      // 3. Cryptographically verify payment
      const transactionId = `tx_test_${Date.now()}`;
      const signature = adapter.generateTestSignature(orderId, transactionId);

      const verifyRes = await request
        .default(app.getHttpServer())
        .post('/api/v1/payments/verify')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({
          orderId,
          transactionId,
          signature,
        })
        .expect(200);

      expect(verifyRes.body.data.verified).toBe(true);
      expect(verifyRes.body.data.payment.status).toBe('SUCCESS');
      expect(verifyRes.body.data.booking.status).toBe('CONFIRMED');

      bookingId = verifyRes.body.data.booking.id;
    });
  });

  describe('Cancellation Fee & Refund Preview APIs', () => {
    it('GET /api/v1/bookings/:id/cancellation-fee -> calculates server-side fee and eligible refund', async () => {
      const res = await request
        .default(app.getHttpServer())
        .get(`/api/v1/bookings/${bookingId}/cancellation-fee`)
        .set('Authorization', `Bearer ${customer1Token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.bookingId).toBe(bookingId);
      expect(res.body.data.totalPrice).toBe(1400);
      expect(res.body.data.amountPaid).toBe(1400);
      // Since slot is in November 2026 (> 24 hours away):
      expect(res.body.data.hoursRemaining).toBeGreaterThan(24);
      expect(res.body.data.cancellationFee).toBe(0);
      expect(res.body.data.refundAmount).toBe(1400);
      expect(res.body.data.refundPercentage).toBe(100);
      expect(res.body.data.refundType).toBe('FULL');
      expect(res.body.data.isEligibleForRefund).toBe(true);
    });

    it('GET /api/v1/bookings/:id/cancellation-fee -> rejects unauthorized customer with 403 Forbidden', async () => {
      const res = await request
        .default(app.getHttpServer())
        .get(`/api/v1/bookings/${bookingId}/cancellation-fee`)
        .set('Authorization', `Bearer ${customer2Token}`)
        .expect(403);

      expect(res.body.statusCode).toBe(403);
    });

    it('GET /api/v1/bookings/:id/refund-preview -> returns financial breakdown and policy terms', async () => {
      const res = await request
        .default(app.getHttpServer())
        .get(`/api/v1/bookings/${bookingId}/refund-preview`)
        .set('Authorization', `Bearer ${customer1Token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.bookingId).toBe(bookingId);
      expect(res.body.data.financials.totalPrice).toBe(1400);
      expect(res.body.data.financials.amountPaid).toBe(1400);
      expect(res.body.data.financials.estimatedRefundAmount).toBe(1400);
      expect(res.body.data.financials.refundType).toBe('FULL');
      expect(res.body.data.policyDetails.freeCancellationHours).toBe(24);
    });
  });

  describe('POST /api/v1/bookings/:id/cancel -> Server-Side Refund Processing', () => {
    it('Cancels booking, frees active slot, and issues full refund automatically', async () => {
      const res = await request
        .default(app.getHttpServer())
        .post(`/api/v1/bookings/${bookingId}/cancel`)
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({
          reason: 'Schedule conflict',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('REFUNDED');
      expect(res.body.data.activeSlotKey).toBeNull();
      expect(res.body.data.cancellationReason).toBe('Schedule conflict');

      // Cancellation and refund payload details
      expect(res.body.data.cancellation).toBeDefined();
      expect(res.body.data.cancellation.refundType).toBe('FULL');
      expect(res.body.data.cancellation.refundAmount).toBe(1400);

      // Verify refund record created in database
      expect(res.body.data.refund).not.toBeNull();
      expect(res.body.data.refund.status).toBe('COMPLETED');
      expect(Number(res.body.data.refund.amount)).toBe(1400);

      refundId = res.body.data.refund.id;

      // Verify Payment record status transitioned to REFUNDED in DB
      const dbPayment = await prisma.payment.findUnique({
        where: { id: paymentId },
      });
      expect(dbPayment?.status).toBe('REFUNDED');

      // Verify Slot is now available for other customers
      const dbBooking = await prisma.booking.findUnique({
        where: { id: bookingId },
      });
      expect(dbBooking?.activeSlotKey).toBeNull();
    });

    it('Rejects cancellation if booking is already cancelled/refunded', async () => {
      const res = await request
        .default(app.getHttpServer())
        .post(`/api/v1/bookings/${bookingId}/cancel`)
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({ reason: 'Duplicate cancel' })
        .expect(400);

      expect(res.body.statusCode).toBe(400);
    });
  });

  describe('Direct Refunds API (POST /api/v1/refunds & GET /api/v1/refunds/:id)', () => {
    let secondBookingId: string;
    let secondPaymentId: string;

    beforeAll(async () => {
      // Create and pay for a second booking
      const holdRes = await request
        .default(app.getHttpServer())
        .post('/api/v1/booking/holds')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({
          turfId,
          holdDate: '2026-11-21',
          startTime: '10:00',
          endTime: '11:00',
        });

      const holdId = holdRes.body.data.id;

      const orderRes = await request
        .default(app.getHttpServer())
        .post('/api/v1/payments/create-order')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({ holdId });

      secondPaymentId = orderRes.body.data.paymentId;
      const orderId = orderRes.body.data.orderId;
      const txId = `tx_second_${Date.now()}`;
      const sig = adapter.generateTestSignature(orderId, txId);

      const verifyRes = await request
        .default(app.getHttpServer())
        .post('/api/v1/payments/verify')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({
          orderId,
          transactionId: txId,
          signature: sig,
        });

      secondBookingId = verifyRes.body.data.booking.id;
    });

    it('POST /api/v1/refunds -> rejects customer attempt to trigger direct refund (Admin/Owner only)', async () => {
      const res = await request
        .default(app.getHttpServer())
        .post('/api/v1/refunds')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({
          bookingId: secondBookingId,
          amount: 500,
        })
        .expect(403);

      expect(res.body.statusCode).toBe(403);
    });

    it('POST /api/v1/refunds -> Admin can process a partial refund', async () => {
      const res = await request
        .default(app.getHttpServer())
        .post('/api/v1/refunds')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          bookingId: secondBookingId,
          amount: 600,
          reason: 'Partial compensation for delayed access',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('COMPLETED');
      expect(Number(res.body.data.amount)).toBe(600);
      expect(res.body.data.refundType).toBe('PARTIAL');

      // Verify payment transitioned to PARTIALLY_REFUNDED
      const dbPayment = await prisma.payment.findUnique({
        where: { id: secondPaymentId },
      });
      expect(dbPayment?.status).toBe('PARTIALLY_REFUNDED');

      // Verify booking transitioned to PARTIALLY_REFUNDED
      const dbBooking = await prisma.booking.findUnique({
        where: { id: secondBookingId },
      });
      expect(dbBooking?.status).toBe('PARTIALLY_REFUNDED');
    });

    it('POST /api/v1/refunds -> rejects refund when amount exceeds remaining balance', async () => {
      // Already refunded 600 of 1400. Remaining balance is 800. Trying to refund 1000 must fail.
      const res = await request
        .default(app.getHttpServer())
        .post('/api/v1/refunds')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          bookingId: secondBookingId,
          amount: 1000,
        })
        .expect(400);

      expect(res.body.statusCode).toBe(400);
    });

    it('GET /api/v1/refunds/:id -> authorized customer can retrieve their refund details', async () => {
      const res = await request
        .default(app.getHttpServer())
        .get(`/api/v1/refunds/${refundId}`)
        .set('Authorization', `Bearer ${customer1Token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(refundId);
      expect(res.body.data.status).toBe('COMPLETED');
      expect(Number(res.body.data.amount)).toBe(1400);
      expect(res.body.data.booking).toBeDefined();
    });

    it('GET /api/v1/refunds/:id -> unauthorized customer cannot view another customer refund (403)', async () => {
      const res = await request
        .default(app.getHttpServer())
        .get(`/api/v1/refunds/${refundId}`)
        .set('Authorization', `Bearer ${customer2Token}`)
        .expect(403);

      expect(res.body.statusCode).toBe(403);
    });
  });
});
