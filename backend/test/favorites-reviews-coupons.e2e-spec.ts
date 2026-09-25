import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { Role } from '../src/common/enums/role.enum';
import { PrismaService } from '../src/database/prisma.service';

describe('Favorites, Reviews & Coupons Subsystems (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const timestamp = Date.now();
  let adminToken: string;
  let ownerToken: string;
  let customerToken: string;

  let testTurfId: string;
  let testReviewId: string;
  let testCouponId: string;

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

    // 1. Register Admin & Assign ADMIN Role
    const adminRes = await request
      .default(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Admin User',
        email: `admin_${timestamp}@test.com`,
        password: 'Password123!',
        role: Role.CUSTOMER,
      });
    const adminUserId = adminRes.body.data.user.id;
    let adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
    if (!adminRole) {
      adminRole = await prisma.role.create({
        data: { name: 'ADMIN', description: 'Platform Administrator' },
      });
    }
    await prisma.userRole.create({
      data: { userId: adminUserId, roleId: adminRole.id },
    });
    const adminLoginRes = await request
      .default(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: `admin_${timestamp}@test.com`,
        password: 'Password123!',
      });
    adminToken = adminLoginRes.body.data.accessToken;

    // 2. Register Turf Owner
    const ownerRes = await request
      .default(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Turf Owner Mike',
        email: `owner_${timestamp}@test.com`,
        password: 'Password123!',
        role: Role.TURF_OWNER,
      });
    ownerToken = ownerRes.body.data.accessToken;
    const ownerUserId = ownerRes.body.data.user.id;

    // 3. Register Customer
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

    // Find or create City
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
            name: 'Karnataka',
            code: `KA_${timestamp}`,
          },
        });
      }
      city = await prisma.city.create({
        data: {
          stateId: state.id,
          name: 'Bangalore',
          slug: `bangalore-${timestamp}`,
        },
      });
    }

    // Ensure owner has a TurfOwner profile
    let turfOwner = await prisma.turfOwner.findUnique({
      where: { userId: ownerUserId },
    });
    if (!turfOwner) {
      turfOwner = await prisma.turfOwner.create({
        data: {
          userId: ownerUserId,
          businessName: 'Mike Sports Arena LLC',
        },
      });
    }

    // Create a turf venue
    const turf = await prisma.turf.create({
      data: {
        ownerId: turfOwner.id,
        cityId: city.id,
        name: `Sunrise Turf Arena ${timestamp}`,
        slug: `sunrise-turf-${timestamp}`,
        addressLine: '123 Stadium Road',
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
  // FAVORITES TESTS
  // ============================================================================
  describe('Favorites Subsystem', () => {
    it('POST /api/v1/favorites/:turfId -> should add turf to user favorites', async () => {
      const res = await request
        .default(app.getHttpServer())
        .post(`/api/v1/favorites/${testTurfId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBe('Turf added to favorites');
      expect(res.body.data.favorite.turfId).toBe(testTurfId);
    });

    it('GET /api/v1/favorites -> should list favorited turfs for customer', async () => {
      const res = await request
        .default(app.getHttpServer())
        .get('/api/v1/favorites')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].turf.id).toBe(testTurfId);
      expect(res.body.data.meta.total).toBe(1);
    });

    it('DELETE /api/v1/favorites/:turfId -> should remove turf from favorites', async () => {
      const res = await request
        .default(app.getHttpServer())
        .delete(`/api/v1/favorites/${testTurfId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBe('Turf removed from favorites');

      // Verify empty list
      const checkRes = await request
        .default(app.getHttpServer())
        .get('/api/v1/favorites')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);
      expect(checkRes.body.data.items).toHaveLength(0);
    });
  });

  // ============================================================================
  // REVIEWS TESTS
  // ============================================================================
  describe('Reviews Subsystem', () => {
    it('POST /api/v1/turfs/:id/reviews -> customer submits review for turf', async () => {
      const res = await request
        .default(app.getHttpServer())
        .post(`/api/v1/turfs/${testTurfId}/reviews`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          rating: 5,
          comment: 'Fantastic grass quality and clean changing rooms!',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBe('Review submitted successfully');
      expect(res.body.data.review.rating).toBe(5);
      testReviewId = res.body.data.review.id;

      // Verify turf rating recalculated
      const turfInDb = await prisma.turf.findUnique({
        where: { id: testTurfId },
      });
      expect(turfInDb?.totalReviews).toBe(1);
      expect(Number(turfInDb?.ratingAverage)).toBe(5);
    });

    it('GET /api/v1/turfs/:id/reviews -> public retrieves reviews with rating distribution', async () => {
      const res = await request
        .default(app.getHttpServer())
        .get(`/api/v1/turfs/${testTurfId}/reviews`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.summary.averageRating).toBe(5);
      expect(res.body.data.summary.totalReviews).toBe(1);
      expect(res.body.data.summary.ratingDistribution['5']).toBe(1);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].comment).toContain(
        'Fantastic grass quality',
      );
    });

    it('PUT /api/v1/reviews/:id -> author updates review', async () => {
      const res = await request
        .default(app.getHttpServer())
        .put(`/api/v1/reviews/${testReviewId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          rating: 4,
          comment: 'Updated feedback: lights could be brighter.',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.review.rating).toBe(4);

      // Verify recalculation
      const turfInDb = await prisma.turf.findUnique({
        where: { id: testTurfId },
      });
      expect(Number(turfInDb?.ratingAverage)).toBe(4);
    });

    it('POST /api/v1/reviews/:id/reply -> turf owner replies to review', async () => {
      const res = await request
        .default(app.getHttpServer())
        .post(`/api/v1/reviews/${testReviewId}/reply`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          reply:
            'Thank you for your feedback! We will upgrade the lights this week.',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.review.ownerReply).toContain('upgrade the lights');
      expect(res.body.data.review.ownerRepliedAt).toBeDefined();
    });

    it('DELETE /api/v1/reviews/:id -> customer deletes their review', async () => {
      const res = await request
        .default(app.getHttpServer())
        .delete(`/api/v1/reviews/${testReviewId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBe('Review deleted successfully');

      // Verify turf rating reset
      const turfInDb = await prisma.turf.findUnique({
        where: { id: testTurfId },
      });
      expect(turfInDb?.totalReviews).toBe(0);
      expect(Number(turfInDb?.ratingAverage)).toBe(0);
    });
  });

  // ============================================================================
  // COUPONS TESTS
  // ============================================================================
  describe('Coupons Subsystem', () => {
    const promoCode = `PROMO${timestamp}`;

    it('POST /api/v1/admin/coupons -> Admin creates a promo coupon', async () => {
      const res = await request
        .default(app.getHttpServer())
        .post('/api/v1/admin/coupons')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: promoCode,
          description: '20% off up to ₹150 for orders above ₹500',
          discountType: 'PERCENTAGE',
          discountValue: 20,
          minOrderAmount: 500,
          maxDiscountAmount: 150,
          endDate: '2099-12-31T23:59:59Z',
          totalUsageLimit: 100,
          perUserLimit: 2,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.coupon.code).toBe(promoCode);
      testCouponId = res.body.data.coupon.id;
    });

    it('GET /api/v1/admin/coupons -> Admin lists all coupons with usage stats', async () => {
      const res = await request
        .default(app.getHttpServer())
        .get('/api/v1/admin/coupons')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/v1/coupons -> Customer views active public coupons', async () => {
      const res = await request
        .default(app.getHttpServer())
        .get('/api/v1/coupons')
        .expect(200);

      expect(res.body.success).toBe(true);
      const found = res.body.data.coupons.find(
        (c: any) => c.code === promoCode,
      );
      expect(found).toBeDefined();
      expect(found.discountValue).toBe(20);
    });

    it('POST /api/v1/coupons/validate -> Fails when order amount is below minimum', async () => {
      const res = await request
        .default(app.getHttpServer())
        .post('/api/v1/coupons/validate')
        .send({
          code: promoCode,
          amount: 400, // Below 500
        })
        .expect(201); // Standard response wrapping

      expect(res.body.data.valid).toBe(false);
      expect(res.body.data.message).toContain(
        'Minimum booking amount of ₹500 required',
      );
    });

    it('POST /api/v1/coupons/validate -> Successfully applies coupon and caps discount', async () => {
      const res = await request
        .default(app.getHttpServer())
        .post('/api/v1/coupons/validate')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          code: promoCode,
          amount: 1000, // 20% of 1000 = 200, but capped at 150
        })
        .expect(201);

      expect(res.body.data.valid).toBe(true);
      expect(res.body.data.discountAmount).toBe(150);
      expect(res.body.data.finalAmount).toBe(850);
    });

    it('PUT /api/v1/admin/coupons/:id -> Admin updates coupon terms', async () => {
      const res = await request
        .default(app.getHttpServer())
        .put(`/api/v1/admin/coupons/${testCouponId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          description: 'Updated terms: now 25% off',
          discountValue: 25,
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Number(res.body.data.coupon.discountValue)).toBe(25);
    });

    it('DELETE /api/v1/admin/coupons/:id -> Admin deletes coupon', async () => {
      const res = await request
        .default(app.getHttpServer())
        .delete(`/api/v1/admin/coupons/${testCouponId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBe('Coupon deleted successfully');
    });
  });
});
