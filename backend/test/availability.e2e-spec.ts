import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { Role } from '../src/common/enums/role.enum';

describe('Turf Availability & Pricing (e2e)', () => {
  let app: INestApplication;

  const timestamp = Date.now();
  let ownerAToken: string;
  let ownerBToken: string;
  let customerToken: string;
  let cityId: string;
  let turfId: string;
  let blockedSlotId: string;

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

    // 1. Register Owner A
    const ownerARes = await request
      .default(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Turf Owner Ava',
        email: `ava_avail_${timestamp}@test.com`,
        password: 'Password123!',
        role: Role.TURF_OWNER,
      });
    ownerAToken = ownerARes.body.data.accessToken;

    // 2. Register Owner B
    const ownerBRes = await request
      .default(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Turf Owner Ben',
        email: `ben_avail_${timestamp}@test.com`,
        password: 'Password123!',
        role: Role.TURF_OWNER,
      });
    ownerBToken = ownerBRes.body.data.accessToken;

    // 3. Register Customer
    const custRes = await request
      .default(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Player Customer',
        email: `cust_avail_${timestamp}@test.com`,
        password: 'Password123!',
        role: Role.CUSTOMER,
      });
    customerToken = custRes.body.data.accessToken;

    // 4. Discover a city
    const turfsList = await request
      .default(app.getHttpServer())
      .get('/api/v1/turfs');
    if (turfsList.body.data && turfsList.body.data.items.length > 0) {
      cityId = turfsList.body.data.items[0].cityId;
    }

    // 5. Owner A creates a turf
    const createTurfRes = await request
      .default(app.getHttpServer())
      .post('/api/v1/owner/turfs')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({
        name: `Velocity Arena ${timestamp}`,
        cityId,
        addressLine: '100 Stadium Road',
        contactPhone: '+919988776655',
        contactEmail: 'contact@velocityarena.com',
        operatingHours: [
          {
            dayOfWeek: 1,
            openTime: '06:00',
            closeTime: '23:00',
            isClosed: false,
          }, // Monday
          {
            dayOfWeek: 2,
            openTime: '06:00',
            closeTime: '23:00',
            isClosed: false,
          }, // Tuesday
          {
            dayOfWeek: 3,
            openTime: '06:00',
            closeTime: '23:00',
            isClosed: false,
          }, // Wednesday
          {
            dayOfWeek: 4,
            openTime: '06:00',
            closeTime: '23:00',
            isClosed: false,
          }, // Thursday
          {
            dayOfWeek: 5,
            openTime: '06:00',
            closeTime: '23:00',
            isClosed: false,
          }, // Friday
          {
            dayOfWeek: 6,
            openTime: '06:00',
            closeTime: '23:00',
            isClosed: false,
          }, // Saturday
          {
            dayOfWeek: 0,
            openTime: '00:00',
            closeTime: '00:00',
            isClosed: true,
          }, // Sunday (Closed)
        ],
        pricingRules: [
          {
            ruleName: 'Standard Weekday',
            dayType: 'WEEKDAY',
            startTime: '06:00',
            endTime: '18:00',
            hourlyPrice: 1200,
          },
          {
            ruleName: 'Prime Peak Evening',
            dayType: 'PEAK',
            startTime: '18:00',
            endTime: '22:00',
            hourlyPrice: 2200,
          },
          {
            ruleName: 'Weekend Prime',
            dayType: 'WEEKEND',
            startTime: '06:00',
            endTime: '23:00',
            hourlyPrice: 1800,
          },
        ],
      });

    turfId = createTurfRes.body.data.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Customer Availability & Pricing Discovery APIs', () => {
    it('GET /api/v1/turfs/:id/availability -> should return multi-day availability overview', async () => {
      const res = await request
        .default(app.getHttpServer())
        .get(`/api/v1/turfs/${turfId}/availability?date=2026-09-21&days=7`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.turfId).toBe(turfId);
      expect(res.body.data.calendar).toHaveLength(7);

      // Verify closed day representation (Sunday is index 6 from Monday)
      const sunday = res.body.data.calendar.find((c: any) => c.dayOfWeek === 0);
      expect(sunday).toBeDefined();
      expect(sunday.isClosed).toBe(true);
      expect(sunday.totalSlots).toBe(0);
      expect(sunday.availableSlotsCount).toBe(0);
    });

    it('GET /api/v1/turfs/:id/pricing -> should return complete pricing matrix', async () => {
      const res = await request
        .default(app.getHttpServer())
        .get(`/api/v1/turfs/${turfId}/pricing`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.pricingMatrix).toBeDefined();
      expect(res.body.data.pricingMatrix.weekday).toHaveLength(1);
      expect(res.body.data.pricingMatrix.weekday[0].hourlyPrice).toBe(1200);
      expect(res.body.data.pricingMatrix.peakHours).toHaveLength(1);
      expect(res.body.data.pricingMatrix.peakHours[0].hourlyPrice).toBe(2200);
      expect(res.body.data.pricingMatrix.weekend).toHaveLength(1);
      expect(res.body.data.pricingMatrix.weekend[0].hourlyPrice).toBe(1800);
    });

    it('GET /api/v1/turfs/:id/available-slots -> normal slot on weekday', async () => {
      // 2026-09-23 is Wednesday
      const res = await request
        .default(app.getHttpServer())
        .get(`/api/v1/turfs/${turfId}/available-slots?date=2026-09-23`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.isClosed).toBe(false);
      expect(res.body.data.totalSlots).toBe(17);

      const normalSlot = res.body.data.slots.find(
        (s: any) => s.startTime === '10:00',
      );
      expect(normalSlot).toBeDefined();
      expect(normalSlot.isAvailable).toBe(true);
      expect(normalSlot.status).toBe('AVAILABLE');
      expect(normalSlot.pricingType).toBe('WEEKDAY');
      expect(normalSlot.price).toBe(1200);
    });

    it('GET /api/v1/turfs/:id/available-slots -> peak pricing in evening', async () => {
      // 2026-09-23 is Wednesday (18:00 - 22:00 is PEAK)
      const res = await request
        .default(app.getHttpServer())
        .get(`/api/v1/turfs/${turfId}/available-slots?date=2026-09-23`)
        .expect(200);

      const peakSlot = res.body.data.slots.find(
        (s: any) => s.startTime === '19:00',
      );
      expect(peakSlot).toBeDefined();
      expect(peakSlot.pricingType).toBe('PEAK');
      expect(peakSlot.price).toBe(2200);
      expect(peakSlot.ruleName).toBe('Prime Peak Evening');
    });

    it('GET /api/v1/turfs/:id/available-slots -> weekend pricing on Saturday', async () => {
      // 2026-09-26 is Saturday
      const res = await request
        .default(app.getHttpServer())
        .get(`/api/v1/turfs/${turfId}/available-slots?date=2026-09-26`)
        .expect(200);

      expect(res.body.data.isClosed).toBe(false);
      const weekendSlot = res.body.data.slots.find(
        (s: any) => s.startTime === '11:00',
      );
      expect(weekendSlot).toBeDefined();
      expect(weekendSlot.pricingType).toBe('WEEKEND');
      expect(weekendSlot.price).toBe(1800);
    });

    it('GET /api/v1/turfs/:id/available-slots -> closed day returns 0 slots and isClosed=true', async () => {
      // 2026-09-27 is Sunday (configured as closed)
      const res = await request
        .default(app.getHttpServer())
        .get(`/api/v1/turfs/${turfId}/available-slots?date=2026-09-27`)
        .expect(200);

      expect(res.body.data.isClosed).toBe(true);
      expect(res.body.data.totalSlots).toBe(0);
      expect(res.body.data.slots).toHaveLength(0);
    });
  });

  describe('Owner Availability & Slot Blocking APIs', () => {
    it('POST /api/v1/owner/turfs/:id/block-slot -> owner blocks slot for maintenance', async () => {
      const res = await request
        .default(app.getHttpServer())
        .post(`/api/v1/owner/turfs/${turfId}/block-slot`)
        .set('Authorization', `Bearer ${ownerAToken}`)
        .send({
          blockDate: '2026-09-23',
          startTime: '14:00',
          endTime: '16:00',
          reason: 'Floodlight Maintenance',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.blockedSlot.reason).toBe('Floodlight Maintenance');
      blockedSlotId = res.body.data.blockedSlot.id;
    });

    it('GET /api/v1/turfs/:id/available-slots -> maintenance block reflects in customer view', async () => {
      const res = await request
        .default(app.getHttpServer())
        .get(`/api/v1/turfs/${turfId}/available-slots?date=2026-09-23`)
        .expect(200);

      const slot14 = res.body.data.slots.find(
        (s: any) => s.startTime === '14:00',
      );
      const slot15 = res.body.data.slots.find(
        (s: any) => s.startTime === '15:00',
      );
      const slot16 = res.body.data.slots.find(
        (s: any) => s.startTime === '16:00',
      );

      expect(slot14.isAvailable).toBe(false);
      expect(slot14.status).toBe('BLOCKED');
      expect(slot14.blockReason).toBe('Floodlight Maintenance');

      expect(slot15.isAvailable).toBe(false);
      expect(slot15.status).toBe('BLOCKED');
      expect(slot15.blockReason).toBe('Floodlight Maintenance');

      // Slot 16:00 is outside the 14:00-16:00 block
      expect(slot16.isAvailable).toBe(true);
      expect(slot16.status).toBe('AVAILABLE');
    });

    it('GET /api/v1/owner/turfs/:id/availability -> owner gets internal availability overview', async () => {
      const res = await request
        .default(app.getHttpServer())
        .get(`/api/v1/owner/turfs/${turfId}/availability`)
        .set('Authorization', `Bearer ${ownerAToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.operatingHours).toHaveLength(7);
      expect(res.body.data.upcomingBlockedSlots).toBeDefined();
    });

    it('PUT /api/v1/owner/turfs/:id/availability -> owner updates operating hours and holiday rate', async () => {
      const res = await request
        .default(app.getHttpServer())
        .put(`/api/v1/owner/turfs/${turfId}/availability`)
        .set('Authorization', `Bearer ${ownerAToken}`)
        .send({
          operatingHours: [
            {
              dayOfWeek: 0,
              openTime: '08:00',
              closeTime: '20:00',
              isClosed: false,
            }, // Now open on Sunday!
          ],
          pricingRules: [
            {
              ruleName: 'Holiday Special Rate',
              dayType: 'HOLIDAY',
              specificDate: '2026-10-02',
              startTime: '06:00',
              endTime: '23:00',
              hourlyPrice: 2500,
            },
          ],
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBe(
        'Turf availability and schedule configured successfully',
      );
    });

    it('DELETE /api/v1/owner/turfs/:id/block-slot/:slotId -> owner unblocks slot', async () => {
      const res = await request
        .default(app.getHttpServer())
        .delete(`/api/v1/owner/turfs/${turfId}/block-slot/${blockedSlotId}`)
        .set('Authorization', `Bearer ${ownerAToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.unblockedSlotId).toBe(blockedSlotId);

      // Verify slot is restored to available in customer view
      const checkRes = await request
        .default(app.getHttpServer())
        .get(`/api/v1/turfs/${turfId}/available-slots?date=2026-09-23`);

      const restoredSlot = checkRes.body.data.slots.find(
        (s: any) => s.startTime === '14:00',
      );
      expect(restoredSlot.isAvailable).toBe(true);
      expect(restoredSlot.status).toBe('AVAILABLE');
    });
  });

  describe('Multi-Tenant Owner Security Checks', () => {
    it('Owner B should receive 403 Forbidden when trying to block slot on Owner A turf', async () => {
      const res = await request
        .default(app.getHttpServer())
        .post(`/api/v1/owner/turfs/${turfId}/block-slot`)
        .set('Authorization', `Bearer ${ownerBToken}`)
        .send({
          blockDate: '2026-09-24',
          startTime: '10:00',
          endTime: '12:00',
          reason: 'Unauthorized Block Attempt',
        })
        .expect(403);

      expect(res.body.statusCode).toBe(403);
    });

    it('Owner B should receive 403 Forbidden when trying to access Owner A availability configuration', async () => {
      const res = await request
        .default(app.getHttpServer())
        .get(`/api/v1/owner/turfs/${turfId}/availability`)
        .set('Authorization', `Bearer ${ownerBToken}`)
        .expect(403);

      expect(res.body.statusCode).toBe(403);
    });

    it('Customer role should receive 403 Forbidden on owner availability endpoints', async () => {
      const res = await request
        .default(app.getHttpServer())
        .get(`/api/v1/owner/turfs/${turfId}/availability`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);

      expect(res.body.statusCode).toBe(403);
    });
  });
});
