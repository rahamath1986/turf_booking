import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { Role } from '../src/common/enums/role.enum';

describe('Authentication & Authorization (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let configService: ConfigService;

  const uniqueId = Date.now();
  const testCustomerEmail = `player_${uniqueId}@turfbooking.test`;
  const testPassword = 'SecurePassword#2026';
  let customerAccessToken: string;
  let customerRefreshToken: string;
  let superAdminAccessToken: string;

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

    jwtService = moduleFixture.get<JwtService>(JwtService);
    configService = moduleFixture.get<ConfigService>(ConfigService);

    // Login as Super Admin (from seed)
    const adminLoginRes = await request
      .default(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'superadmin.demo@turfplatform.test',
        password: 'TestSecurePass#2026',
      });

    if (adminLoginRes.status === 200 && adminLoginRes.body?.data?.accessToken) {
      superAdminAccessToken = adminLoginRes.body.data.accessToken;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  // ---------------------------------------------------------------------------
  // 1. REGISTRATION
  // ---------------------------------------------------------------------------
  describe('Registration (POST /api/v1/auth/register)', () => {
    it('should register a new customer with hashed password and return tokens', async () => {
      const res = await request
        .default(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          fullName: 'Arjun Das',
          email: testCustomerEmail,
          phone: `+9198${String(uniqueId).slice(-8)}`,
          password: testPassword,
          role: Role.CUSTOMER,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.email).toBe(testCustomerEmail);
      expect(res.body.data.user.roles).toContain(Role.CUSTOMER);
      // Plaintext password or hash MUST NOT be exposed in response
      expect(res.body.data.user.password).toBeUndefined();
      expect(res.body.data.user.passwordHash).toBeUndefined();
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();

      customerAccessToken = res.body.data.accessToken;
      customerRefreshToken = res.body.data.refreshToken;
    });

    it('should fail with 409 Conflict when attempting to register duplicate email', async () => {
      const res = await request
        .default(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          fullName: 'Duplicate Arjun',
          email: testCustomerEmail,
          password: testPassword,
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(409);
    });

    it('should fail with 400 Bad Request on invalid input (weak password)', async () => {
      const res = await request
        .default(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          fullName: 'Short Pass',
          email: `shortpass_${uniqueId}@example.com`,
          password: '123', // Less than 8 characters
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. LOGIN
  // ---------------------------------------------------------------------------
  describe('Login (POST /api/v1/auth/login)', () => {
    it('should authenticate successfully with valid credentials and return JWT tokens', async () => {
      const res = await request
        .default(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testCustomerEmail,
          password: testPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(testCustomerEmail);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();

      customerAccessToken = res.body.data.accessToken;
      customerRefreshToken = res.body.data.refreshToken;
    });

    // -------------------------------------------------------------------------
    // 3. INVALID PASSWORD
    // -------------------------------------------------------------------------
    it('should reject login with 401 Unauthorized when password is invalid', async () => {
      const res = await request
        .default(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testCustomerEmail,
          password: 'CompletelyWrongPassword#999',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid email or password');
    });

    it('should reject login with 401 Unauthorized when user email does not exist', async () => {
      const res = await request
        .default(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent.user.999@example.com',
          password: testPassword,
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. UNAUTHORIZED REQUEST
  // ---------------------------------------------------------------------------
  describe('Unauthorized Request (Protected endpoints without token)', () => {
    it('should return 401 Unauthorized when accessing GET /api/v1/auth/me without Bearer token', async () => {
      const res = await request
        .default(app.getHttpServer())
        .get('/api/v1/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 401 Unauthorized when Authorization header is malformed', async () => {
      const res = await request
        .default(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', 'InvalidFormatBearerToken');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. EXPIRED TOKEN
  // ---------------------------------------------------------------------------
  describe('Expired Token', () => {
    it('should return 401 Unauthorized when token expiration time has elapsed', async () => {
      const accessSecret = configService.get<string>(
        'jwt.accessSecret',
        'dev_super_secret_jwt_access_key_min_32_chars_2026_sports',
      );

      // Forge an already expired JWT (expired 1 hour ago)
      const expiredToken = jwtService.sign(
        {
          sub: 'sample-user-id',
          email: testCustomerEmail,
          roles: [Role.CUSTOMER],
        },
        {
          secret: accessSecret,
          expiresIn: '-1h',
        },
      );

      const res = await request
        .default(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // 6. ROLE AUTHORIZATION (RBAC)
  // ---------------------------------------------------------------------------
  describe('Role-Based Authorization (RBAC)', () => {
    it('should allow CUSTOMER to access their own profile (GET /api/v1/auth/me)', async () => {
      const res = await request
        .default(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${customerAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe(testCustomerEmail);
      expect(res.body.data.roles).toContain(Role.CUSTOMER);
    });

    it('should deny CUSTOMER from accessing Admin-only endpoint (GET /api/v1/admin/stats) with 403 Forbidden', async () => {
      const res = await request
        .default(app.getHttpServer())
        .get('/api/v1/admin/stats')
        .set('Authorization', `Bearer ${customerAccessToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(403);
      expect(res.body.message).toContain('Access denied: requires one of');
    });

    it('should grant SUPER_ADMIN access to Admin-only endpoint (GET /api/v1/admin/stats) with 200 OK', async () => {
      if (!superAdminAccessToken) {
        // Fallback login if not populated in beforeAll
        const loginRes = await request
          .default(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({
            email: 'superadmin.demo@turfplatform.test',
            password: 'TestSecurePass#2026',
          });
        superAdminAccessToken = loginRes.body.data.accessToken;
      }

      const res = await request
        .default(app.getHttpServer())
        .get('/api/v1/admin/stats')
        .set('Authorization', `Bearer ${superAdminAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.database).toBe('turf_booking_db');
    });
  });

  // ---------------------------------------------------------------------------
  // 7. REFRESH TOKEN ROTATION
  // ---------------------------------------------------------------------------
  describe('Refresh Token Rotation (POST /api/v1/auth/refresh-token)', () => {
    it('should rotate refresh token and issue new valid access token', async () => {
      const res = await request
        .default(app.getHttpServer())
        .post('/api/v1/auth/refresh-token')
        .send({
          refreshToken: customerRefreshToken,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.body.data.refreshToken).not.toBe(customerRefreshToken);

      const oldToken = customerRefreshToken;
      customerRefreshToken = res.body.data.refreshToken;
      customerAccessToken = res.body.data.accessToken;

      // Token reuse detection: Reusing old revoked token must trigger 401 security alert
      const reuseRes = await request
        .default(app.getHttpServer())
        .post('/api/v1/auth/refresh-token')
        .send({
          refreshToken: oldToken,
        });

      expect(reuseRes.status).toBe(401);
      expect(reuseRes.body.success).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // 8. OTP DISPATCH & VERIFICATION
  // ---------------------------------------------------------------------------
  describe('OTP Lifecycle (POST /api/v1/auth/send-otp & verify-otp)', () => {
    it('should dispatch OTP and successfully verify', async () => {
      const otpPhone = `+9191${String(uniqueId).slice(-8)}`;

      const sendRes = await request
        .default(app.getHttpServer())
        .post('/api/v1/auth/send-otp')
        .send({
          identifier: otpPhone,
          purpose: 'REGISTER',
        });

      expect(sendRes.status).toBe(200);
      expect(sendRes.body.success).toBe(true);
      const devOtp = sendRes.body.data.devOtp;
      expect(devOtp).toBeDefined();

      const verifyRes = await request
        .default(app.getHttpServer())
        .post('/api/v1/auth/verify-otp')
        .send({
          identifier: otpPhone,
          otp: devOtp,
          purpose: 'REGISTER',
        });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.success).toBe(true);
    });
  });
});
