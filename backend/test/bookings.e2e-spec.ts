import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { Role } from '../src/common/enums/role.enum';
import { PrismaService } from '../src/database/prisma.service';

describe('Production Booking Engine & Concurrency (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const timestamp = Date.now();
  let customerAToken: string;
  let customerBToken: string;
  let customerCToken: string;
  let ownerToken: string;
  let cityId: string;
  let turfId: string;

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
    prisma = app.get<PrismaService>(PrismaService);

    // 1. Register Owner
    const ownerRes = await request
      .default(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Turf Owner Carlos',
        email: `carlos_booking_${timestamp}@test.com`,
        password: 'Password123!',
        role: Role.TURF_OWNER,
      });
    ownerToken = ownerRes.body.data.accessToken;

    // 2. Register Customers
    const custARes = await request
      .default(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Player Arthur',
        email: `arthur_${timestamp}@test.com`,
        password: 'Password123!',
        role: Role.CUSTOMER,
      });
    customerAToken = custARes.body.data.accessToken;

    const custBRes = await request
      .default(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Player Brian',
        email: `brian_${timestamp}@test.com`,
        password: 'Password123!',
        role: Role.CUSTOMER,
      });
    customerBToken = custBRes.body.data.accessToken;

    const custCRes = await request
      .default(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Player Chloe',
        email: `chloe_${timestamp}@test.com`,
        password: 'Password123!',
        role: Role.CUSTOMER,
      });
    customerCToken = custCRes.body.data.accessToken;

    // 3. Discover City
    const turfsList = await request
      .default(app.getHttpServer())
      .get('/api/v1/turfs');
    if (turfsList.body.data && turfsList.body.data.items.length > 0) {
      cityId = turfsList.body.data.items[0].cityId;
    }

    // 4. Create Turf for Booking Tests
    const turfRes = await request
      .default(app.getHttpServer())
      .post('/api/v1/owner/turfs')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: `Cyber Arena ${timestamp}`,
        cityId,
        addressLine: '500 Tech Boulevard',
        contactPhone: '+919123456780',
        contactEmail: 'contact@cyberarena.com',
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
            hourlyPrice: 1500,
          },
        ],
      });

    turfId = turfRes.body.data.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Slot Hold Lifecycle', () => {
    let holdId: string;

    it('POST /api/v1/booking/holds -> should create a 10-minute hold', async () => {
      const res = await request
        .default(app.getHttpServer())
        .post('/api/v1/booking/holds')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          turfId,
          holdDate: '2026-10-05',
          startTime: '10:00',
          endTime: '11:00',
          idempotencyKey: `idem_hold_${timestamp}`,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ACTIVE');
      expect(res.body.data.holdCode).toBeDefined();
      expect(res.body.data.totalPrice).toBe('1500');
      holdId = res.body.data.id;
    });

    it('POST /api/v1/booking/holds -> duplicate attempt while held should return 409 Conflict', async () => {
      const res = await request
        .default(app.getHttpServer())
        .post('/api/v1/booking/holds')
        .set('Authorization', `Bearer ${customerBToken}`)
        .send({
          turfId,
          holdDate: '2026-10-05',
          startTime: '10:00',
          endTime: '11:00',
        })
        .expect(409);

      expect(res.body.statusCode).toBe(409);
    });

    it('GET /api/v1/booking/holds/:id -> retrieve hold status', async () => {
      const res = await request
        .default(app.getHttpServer())
        .get(`/api/v1/booking/holds/${holdId}`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(holdId);
      expect(res.body.data.status).toBe('ACTIVE');
    });

    it('DELETE /api/v1/booking/holds/:id -> release hold voluntarily', async () => {
      const res = await request
        .default(app.getHttpServer())
        .delete(`/api/v1/booking/holds/${holdId}`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.hold.status).toBe('RELEASED');

      // Now customer B can hold it!
      const resB = await request
        .default(app.getHttpServer())
        .post('/api/v1/booking/holds')
        .set('Authorization', `Bearer ${customerBToken}`)
        .send({
          turfId,
          holdDate: '2026-10-05',
          startTime: '10:00',
          endTime: '11:00',
        })
        .expect(201);

      expect(resB.body.success).toBe(true);
      expect(resB.body.data.status).toBe('ACTIVE');
    });
  });

  describe('Standard Booking Flow & Lifecycle', () => {
    let holdId: string;
    let bookingId: string;

    it('Step 1: Hold slot -> Step 2: Confirm booking from hold', async () => {
      // 1. Hold slot
      const holdRes = await request
        .default(app.getHttpServer())
        .post('/api/v1/booking/holds')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          turfId,
          holdDate: '2026-10-06',
          startTime: '18:00',
          endTime: '19:00',
        })
        .expect(201);

      holdId = holdRes.body.data.id;

      // 2. Confirm booking from hold
      const bookRes = await request
        .default(app.getHttpServer())
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          holdId,
          idempotencyKey: `idem_book_${timestamp}`,
        })
        .expect(201);

      expect(bookRes.body.success).toBe(true);
      expect(bookRes.body.data.status).toBe('CONFIRMED');
      expect(bookRes.body.data.bookingNumber).toBeDefined();
      bookingId = bookRes.body.data.id;
    });

    it('GET /api/v1/bookings/:id/status -> check lightweight status', async () => {
      const res = await request
        .default(app.getHttpServer())
        .get(`/api/v1/bookings/${bookingId}/status`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('CONFIRMED');
    });

    it('GET /api/v1/bookings/:id -> get full details and auditable history', async () => {
      const res = await request
        .default(app.getHttpServer())
        .get(`/api/v1/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.statusHistory).toBeDefined();
      expect(res.body.data.statusHistory.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.statusHistory[0].toStatus).toBe('CONFIRMED');
    });

    it('GET /api/v1/bookings -> list paginated bookings', async () => {
      const res = await request
        .default(app.getHttpServer())
        .get('/api/v1/bookings?status=CONFIRMED')
        .set('Authorization', `Bearer ${customerAToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toBeDefined();
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.meta.totalItems).toBeGreaterThanOrEqual(1);
    });

    it('POST /api/v1/bookings/:id/reschedule -> reschedule active booking', async () => {
      const res = await request
        .default(app.getHttpServer())
        .post(`/api/v1/bookings/${bookingId}/reschedule`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          newDate: '2026-10-07',
          newStartTime: '20:00',
          newEndTime: '21:00',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.startTime).toBe('20:00');

      // Verify status history was updated
      const detailRes = await request
        .default(app.getHttpServer())
        .get(`/api/v1/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(detailRes.body.data.statusHistory.length).toBe(2);
      expect(detailRes.body.data.statusHistory[1].reason).toContain(
        'Rescheduled',
      );
    });

    it('POST /api/v1/bookings/:id/cancel -> cancel booking and free slot', async () => {
      const res = await request
        .default(app.getHttpServer())
        .post(`/api/v1/bookings/${bookingId}/cancel`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          reason: 'Severe Thunderstorm',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('CANCELLED');

      // Verify the slot is now free for Customer B to book!
      const rebookRes = await request
        .default(app.getHttpServer())
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${customerBToken}`)
        .send({
          turfId,
          bookingDate: '2026-10-07',
          startTime: '20:00',
          endTime: '21:00',
        })
        .expect(201);

      expect(rebookRes.body.success).toBe(true);
      expect(rebookRes.body.data.status).toBe('CONFIRMED');
    });
  });

  describe('CRITICAL CONCURRENCY TEST: Prevent Double Booking', () => {
    it('Simultaneous booking attempts: EXACTLY ONE customer succeeds, ALL others receive 409 Conflict', async () => {
      const targetDate = '2026-10-10';
      const targetStartTime = '16:00';
      const targetEndTime = '17:00';

      // 5 concurrent requests attempting to book the EXACT same slot at the exact same millisecond
      const concurrentRequests = [
        request
          .default(app.getHttpServer())
          .post('/api/v1/bookings')
          .set('Authorization', `Bearer ${customerAToken}`)
          .send({
            turfId,
            bookingDate: targetDate,
            startTime: targetStartTime,
            endTime: targetEndTime,
          }),

        request
          .default(app.getHttpServer())
          .post('/api/v1/bookings')
          .set('Authorization', `Bearer ${customerBToken}`)
          .send({
            turfId,
            bookingDate: targetDate,
            startTime: targetStartTime,
            endTime: targetEndTime,
          }),

        request
          .default(app.getHttpServer())
          .post('/api/v1/bookings')
          .set('Authorization', `Bearer ${customerCToken}`)
          .send({
            turfId,
            bookingDate: targetDate,
            startTime: targetStartTime,
            endTime: targetEndTime,
          }),

        request
          .default(app.getHttpServer())
          .post('/api/v1/bookings')
          .set('Authorization', `Bearer ${customerAToken}`)
          .send({
            turfId,
            bookingDate: targetDate,
            startTime: targetStartTime,
            endTime: targetEndTime,
          }),

        request
          .default(app.getHttpServer())
          .post('/api/v1/bookings')
          .set('Authorization', `Bearer ${customerBToken}`)
          .send({
            turfId,
            bookingDate: targetDate,
            startTime: targetStartTime,
            endTime: targetEndTime,
          }),
      ];

      const responses = await Promise.all(concurrentRequests);

      const successCount = responses.filter((r) => r.status === 201).length;
      const conflictCount = responses.filter((r) => r.status === 409).length;

      expect(successCount).toBe(1);
      expect(conflictCount).toBe(4);

      // Verify at the physical database level: ONLY 1 booking exists
      const dbBookings = await prisma.booking.findMany({
        where: {
          turfId,
          bookingDate: new Date(targetDate),
          startTime: targetStartTime,
          status: 'CONFIRMED',
        },
      });

      expect(dbBookings).toHaveLength(1);
    });

    it('Simultaneous hold attempts: EXACTLY ONE customer acquires hold, ALL others receive 409 Conflict', async () => {
      const targetDate = '2026-10-11';
      const targetStartTime = '14:00';
      const targetEndTime = '15:00';

      const concurrentHoldRequests = [
        request
          .default(app.getHttpServer())
          .post('/api/v1/booking/holds')
          .set('Authorization', `Bearer ${customerAToken}`)
          .send({
            turfId,
            holdDate: targetDate,
            startTime: targetStartTime,
            endTime: targetEndTime,
          }),

        request
          .default(app.getHttpServer())
          .post('/api/v1/booking/holds')
          .set('Authorization', `Bearer ${customerBToken}`)
          .send({
            turfId,
            holdDate: targetDate,
            startTime: targetStartTime,
            endTime: targetEndTime,
          }),

        request
          .default(app.getHttpServer())
          .post('/api/v1/booking/holds')
          .set('Authorization', `Bearer ${customerCToken}`)
          .send({
            turfId,
            holdDate: targetDate,
            startTime: targetStartTime,
            endTime: targetEndTime,
          }),
      ];

      const responses = await Promise.all(concurrentHoldRequests);

      const successHolds = responses.filter((r) => r.status === 201).length;
      const conflictHolds = responses.filter((r) => r.status === 409).length;

      expect(successHolds).toBe(1);
      expect(conflictHolds).toBe(2);

      // Verify at the database level: ONLY 1 active hold exists
      const dbHolds = await prisma.slotHold.findMany({
        where: {
          turfId,
          holdDate: new Date(targetDate),
          startTime: targetStartTime,
          status: 'ACTIVE',
        },
      });

      expect(dbHolds).toHaveLength(1);
    });
  });
});
