import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { Role } from '../src/common/enums/role.enum';
import { PrismaService } from '../src/database/prisma.service';

describe('Owner Management & Analytics (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const timestamp = Date.now();
  let ownerToken: string;
  let customerToken: string;
  let testTurfId: string;
  let testBookingId: string;

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

    // 1. Register Turf Owner
    const ownerRes = await request
      .default(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Stadium Owner David',
        email: `david_owner_${timestamp}@test.com`,
        password: 'Password123!',
        role: Role.TURF_OWNER,
      });
    ownerToken = ownerRes.body.data.accessToken;
    const ownerUserId = ownerRes.body.data.user.id;

    // 2. Register Regular Customer
    const custRes = await request
      .default(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Player Customer',
        email: `cust_${timestamp}@test.com`,
        password: 'Password123!',
        role: Role.CUSTOMER,
      });
    customerToken = custRes.body.data.accessToken;

    // Resolve or create City
    let city = await prisma.city.findFirst();
    if (!city) {
      let country = await prisma.country.findFirst();
      if (!country) {
        country = await prisma.country.create({
          data: { name: 'India', code: `IN_${timestamp}`, phoneCode: '+91' },
        });
      }
      let state = await prisma.state.findFirst();
      if (!state) {
        state = await prisma.state.create({
          data: {
            countryId: country.id,
            name: 'Maharashtra',
            code: `MH_${timestamp}`,
          },
        });
      }
      city = await prisma.city.create({
        data: {
          stateId: state.id,
          name: 'Mumbai',
          slug: `mumbai-${timestamp}`,
        },
      });
    }

    // Ensure owner has TurfOwner record
    let turfOwner = await prisma.turfOwner.findUnique({
      where: { userId: ownerUserId },
    });
    if (!turfOwner) {
      turfOwner = await prisma.turfOwner.create({
        data: {
          userId: ownerUserId,
          businessName: 'David Sports World',
        },
      });
    }

    // Create a turf venue for this owner
    const turf = await prisma.turf.create({
      data: {
        ownerId: turfOwner.id,
        cityId: city.id,
        name: `David Arena ${timestamp}`,
        slug: `david-arena-${timestamp}`,
        addressLine: '99 Sports Boulevard',
        isActive: true,
        isApproved: true,
      },
    });
    testTurfId = turf.id;
  });

  afterAll(async () => {
    await app.close();
  });

  // ============================================================================
  // RBAC & SECURITY
  // ============================================================================
  describe('RBAC Security Enforcement', () => {
    it('GET /api/v1/owner/dashboard -> should reject customer with 403 Forbidden', async () => {
      await request
        .default(app.getHttpServer())
        .get('/api/v1/owner/dashboard')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);
    });

    it('GET /api/v1/owner/dashboard -> should reject unauthenticated request with 401', async () => {
      await request
        .default(app.getHttpServer())
        .get('/api/v1/owner/dashboard')
        .expect(401);
    });
  });

  // ============================================================================
  // OWNER BOOKINGS MANAGEMENT
  // ============================================================================
  describe('Owner Bookings Lifecycle', () => {
    it('POST /api/v1/owner/bookings/walk-in -> should create a confirmed walk-in booking', async () => {
      const res = await request
        .default(app.getHttpServer())
        .post('/api/v1/owner/bookings/walk-in')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          turfId: testTurfId,
          bookingDate: '2026-10-15',
          startTime: '18:00',
          endTime: '19:00',
          customerName: 'Marcus Walkin',
          customerPhone: '+919123456780',
          customerEmail: `marcus_${timestamp}@walkin.test`,
          price: 1500,
          paymentMethod: 'CASH',
          notes: 'Paid at desk',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.booking.bookingNumber).toContain('WLK-');
      expect(res.body.data.booking.status).toBe('CONFIRMED');
      expect(res.body.data.booking.totalPrice).toBe(1500);

      testBookingId = res.body.data.booking.id;
    });

    it('POST /api/v1/owner/bookings/walk-in -> should reject double-booking for same slot with 409 Conflict', async () => {
      await request
        .default(app.getHttpServer())
        .post('/api/v1/owner/bookings/walk-in')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          turfId: testTurfId,
          bookingDate: '2026-10-15',
          startTime: '18:00',
          endTime: '19:00',
          customerName: 'Duplicate Player',
          customerPhone: '+919123456789',
        })
        .expect(409);
    });

    it('GET /api/v1/owner/bookings -> should list bookings for owner venues', async () => {
      const res = await request
        .default(app.getHttpServer())
        .get('/api/v1/owner/bookings')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.items[0].turfId).toBe(testTurfId);
    });

    it('GET /api/v1/owner/bookings/:id -> should return full booking details', async () => {
      const res = await request
        .default(app.getHttpServer())
        .get(`/api/v1/owner/bookings/${testBookingId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.booking.id).toBe(testBookingId);
      expect(res.body.data.booking.status).toBe('CONFIRMED');
      expect(res.body.data.booking.statusHistory.length).toBeGreaterThanOrEqual(
        1,
      );
    });

    it('POST /api/v1/owner/bookings/:id/reschedule -> should reschedule booking to new slot', async () => {
      const res = await request
        .default(app.getHttpServer())
        .post(`/api/v1/owner/bookings/${testBookingId}/reschedule`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          newDate: '2026-10-16',
          newStartTime: '20:00',
          newEndTime: '21:00',
          reason: 'Customer requested 8 PM slot next day',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBe('Booking rescheduled successfully');
      expect(res.body.data.booking.startTime).toBe('20:00');
    });

    it('POST /api/v1/owner/bookings/:id/cancel -> should cancel booking and release slot', async () => {
      const res = await request
        .default(app.getHttpServer())
        .post(`/api/v1/owner/bookings/${testBookingId}/cancel`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          reason: 'Customer requested cancellation due to travel',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBe(
        'Booking cancelled successfully by turf owner',
      );
      expect(res.body.data.booking.status).toBe('CANCELLED');

      // Verify activeSlotKey is cleared in database
      const bookingDb = await prisma.booking.findUnique({
        where: { id: testBookingId },
      });
      expect(bookingDb?.activeSlotKey).toBeNull();
    });
  });

  // ============================================================================
  // OWNER ANALYTICS & DASHBOARD APIS
  // ============================================================================
  describe('Owner Analytics & Dashboard', () => {
    it('GET /api/v1/owner/dashboard -> returns executive summary metrics', async () => {
      const res = await request
        .default(app.getHttpServer())
        .get('/api/v1/owner/dashboard')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.activeTurfsCount).toBe(1);
      expect(res.body.data.allTime.bookingsCount).toBeGreaterThanOrEqual(1);
      expect(res.body.data.allTime.cancelledCount).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/v1/owner/dashboard/revenue -> returns revenue analytics and turf breakdown', async () => {
      const res = await request
        .default(app.getHttpServer())
        .get('/api/v1/owner/dashboard/revenue')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.turfBreakdown).toBeDefined();
      expect(Array.isArray(res.body.data.dailyRevenue)).toBe(true);
      expect(Array.isArray(res.body.data.monthlyRevenue)).toBe(true);
    });

    it('GET /api/v1/owner/dashboard/bookings -> returns booking status breakdown and trends', async () => {
      const res = await request
        .default(app.getHttpServer())
        .get('/api/v1/owner/dashboard/bookings')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.totalBookings).toBeGreaterThanOrEqual(1);
      expect(res.body.data.byStatus.CANCELLED).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(res.body.data.dailyTrend)).toBe(true);
      expect(Array.isArray(res.body.data.byTurf)).toBe(true);
    });

    it('GET /api/v1/owner/dashboard/occupancy -> returns occupancy metrics', async () => {
      const res = await request
        .default(app.getHttpServer())
        .get('/api/v1/owner/dashboard/occupancy')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.turfOccupancies).toBeDefined();
      expect(Array.isArray(res.body.data.dailyOccupancy)).toBe(true);
    });

    it('GET /api/v1/owner/dashboard/peak-hours -> returns slot frequencies and popular slots', async () => {
      const res = await request
        .default(app.getHttpServer())
        .get('/api/v1/owner/dashboard/peak-hours')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.slotFrequencies)).toBe(true);
      expect(Array.isArray(res.body.data.popularSlots)).toBe(true);
      expect(res.body.data.periodBreakdown).toBeDefined();
    });
  });
});
