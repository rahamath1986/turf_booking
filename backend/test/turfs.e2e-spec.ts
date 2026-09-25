import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { Role } from '../src/common/enums/role.enum';

describe('Turf Management (e2e)', () => {
  let app: INestApplication;

  const timestamp = Date.now();
  let ownerAToken: string;
  let ownerBToken: string;
  let customerToken: string;
  let cityId: string;
  let turfAId: string;
  let seededTurfId: string;

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
        fullName: 'Owner Alice',
        email: `alice_${timestamp}@turfowner.test`,
        password: 'SecurePassword#2026',
        role: Role.TURF_OWNER,
      });
    ownerAToken = ownerARes.body.data.accessToken;

    // 2. Register Owner B
    const ownerBRes = await request
      .default(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Owner Bob',
        email: `bob_${timestamp}@turfowner.test`,
        password: 'SecurePassword#2026',
        role: Role.TURF_OWNER,
      });
    ownerBToken = ownerBRes.body.data.accessToken;

    // 3. Register Customer
    const customerRes = await request
      .default(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Customer Charlie',
        email: `charlie_${timestamp}@customer.test`,
        password: 'SecurePassword#2026',
        role: Role.CUSTOMER,
      });
    customerToken = customerRes.body.data.accessToken;

    // 4. Retrieve seeded city
    const citiesRes = await request
      .default(app.getHttpServer())
      .get('/api/v1/locations/cities');
    cityId = citiesRes.body.data[0].id;

    // 5. Retrieve seeded turf ID
    const turfsRes = await request
      .default(app.getHttpServer())
      .get('/api/v1/turfs');
    if (turfsRes.body.data?.items?.length > 0) {
      seededTurfId = turfsRes.body.data.items[0].id;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  // ===========================================================================
  // 1. CUSTOMER APIS
  // ===========================================================================
  describe('Customer Turf Discovery & Browsing', () => {
    it('GET /api/v1/turfs - should return paginated list of active turfs', async () => {
      const res = await request
        .default(app.getHttpServer())
        .get('/api/v1/turfs')
        .query({ page: 1, limit: 10 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toBeDefined();
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.meta).toBeDefined();
      expect(res.body.data.meta.page).toBe(1);
    });

    it('GET /api/v1/turfs/search - should search turfs by keyword', async () => {
      const res = await request
        .default(app.getHttpServer())
        .get('/api/v1/turfs/search')
        .query({ search: 'Spartan' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toBeDefined();
    });

    it('GET /api/v1/turfs/nearby - should filter turfs by coordinates and radius', async () => {
      const res = await request
        .default(app.getHttpServer())
        .get('/api/v1/turfs/nearby')
        .query({
          latitude: 12.9352,
          longitude: 77.6245,
          radiusKm: 25,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toBeDefined();
      expect(res.body.data.meta.searchRadiusKm).toBe(25);
      if (res.body.data.items.length > 0) {
        expect(res.body.data.items[0].distanceKm).toBeDefined();
        expect(res.body.data.items[0].distanceKm).toBeLessThanOrEqual(25);
      }
    });

    it('GET /api/v1/turfs/featured - should return featured venues', async () => {
      const res = await request
        .default(app.getHttpServer())
        .get('/api/v1/turfs/featured');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('GET /api/v1/turfs/popular - should return popular venues', async () => {
      const res = await request
        .default(app.getHttpServer())
        .get('/api/v1/turfs/popular');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('GET /api/v1/turfs/:id - should return single turf details', async () => {
      const res = await request
        .default(app.getHttpServer())
        .get(`/api/v1/turfs/${seededTurfId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(seededTurfId);
      expect(res.body.data.name).toBeDefined();
    });

    it('GET /api/v1/turfs/:id/sports - should return sports for turf', async () => {
      const res = await request
        .default(app.getHttpServer())
        .get(`/api/v1/turfs/${seededTurfId}/sports`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('GET /api/v1/turfs/:id/facilities - should return facilities for turf', async () => {
      const res = await request
        .default(app.getHttpServer())
        .get(`/api/v1/turfs/${seededTurfId}/facilities`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('GET /api/v1/turfs/:id/images - should return gallery images for turf', async () => {
      const res = await request
        .default(app.getHttpServer())
        .get(`/api/v1/turfs/${seededTurfId}/images`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('GET /api/v1/turfs/:id/rules - should return rules for turf', async () => {
      const res = await request
        .default(app.getHttpServer())
        .get(`/api/v1/turfs/${seededTurfId}/rules`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.rules).toBeDefined();
    });

    it('GET /api/v1/turfs/:id/policies - should return cancellation policies for turf', async () => {
      const res = await request
        .default(app.getHttpServer())
        .get(`/api/v1/turfs/${seededTurfId}/policies`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.cancellationPolicy).toBeDefined();
    });
  });

  // ===========================================================================
  // 2. OWNER APIS & MULTI-TENANT ISOLATION
  // ===========================================================================
  describe('Owner Turf Operations & Multi-Tenant Authorization', () => {
    it('POST /api/v1/owner/turfs - should allow Owner A to create a new turf venue', async () => {
      const res = await request
        .default(app.getHttpServer())
        .post('/api/v1/owner/turfs')
        .set('Authorization', `Bearer ${ownerAToken}`)
        .send({
          name: `Alice Premier Arena ${timestamp}`,
          cityId,
          addressLine: '12th Main Road, Indiranagar',
          postalCode: '560038',
          latitude: 12.9784,
          longitude: 77.6408,
          rules: 'No smoking, clean footwear',
          cancellationPolicy: 'Refund allowed 6h prior',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toContain('Alice Premier Arena');
      turfAId = res.body.data.id;
    });

    it('GET /api/v1/owner/turfs - should return only turfs owned by Owner A', async () => {
      const res = await request
        .default(app.getHttpServer())
        .get('/api/v1/owner/turfs')
        .set('Authorization', `Bearer ${ownerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const turfIds = res.body.data.items.map((t: any) => t.id);
      expect(turfIds).toContain(turfAId);
    });

    it('PUT /api/v1/owner/turfs/:id - should allow Owner A to update their turf', async () => {
      const res = await request
        .default(app.getHttpServer())
        .put(`/api/v1/owner/turfs/${turfAId}`)
        .set('Authorization', `Bearer ${ownerAToken}`)
        .send({
          description: 'Updated arena description by Owner A',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.description).toBe(
        'Updated arena description by Owner A',
      );
    });

    it('PATCH /api/v1/owner/turfs/:id/status - should allow Owner A to toggle active status', async () => {
      const res = await request
        .default(app.getHttpServer())
        .patch(`/api/v1/owner/turfs/${turfAId}/status`)
        .set('Authorization', `Bearer ${ownerAToken}`)
        .send({ isActive: false });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isActive).toBe(false);
    });

    // -------------------------------------------------------------------------
    // CRITICAL: Multi-tenant ownership boundary tests
    // -------------------------------------------------------------------------
    it('GET /api/v1/owner/turfs/:id - should REJECT Owner B from viewing Owner A turf with 403 Forbidden', async () => {
      const res = await request
        .default(app.getHttpServer())
        .get(`/api/v1/owner/turfs/${turfAId}`)
        .set('Authorization', `Bearer ${ownerBToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(403);
      expect(res.body.message).toContain('Access denied');
    });

    it('PUT /api/v1/owner/turfs/:id - should REJECT Owner B from updating Owner A turf with 403 Forbidden', async () => {
      const res = await request
        .default(app.getHttpServer())
        .put(`/api/v1/owner/turfs/${turfAId}`)
        .set('Authorization', `Bearer ${ownerBToken}`)
        .send({ name: 'Malicious Rename Attempt' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('DELETE /api/v1/owner/turfs/:id - should REJECT Owner B from deleting Owner A turf with 403 Forbidden', async () => {
      const res = await request
        .default(app.getHttpServer())
        .delete(`/api/v1/owner/turfs/${turfAId}`)
        .set('Authorization', `Bearer ${ownerBToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('POST /api/v1/owner/turfs - should REJECT regular Customer from calling Owner API with 403 Forbidden', async () => {
      const res = await request
        .default(app.getHttpServer())
        .post('/api/v1/owner/turfs')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Unauthorized Customer Turf',
          cityId,
          addressLine: 'Nowhere Road',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('DELETE /api/v1/owner/turfs/:id - should allow Owner A to soft-delete their own turf', async () => {
      const res = await request
        .default(app.getHttpServer())
        .delete(`/api/v1/owner/turfs/${turfAId}`)
        .set('Authorization', `Bearer ${ownerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
