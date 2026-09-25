import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

describe('Turf Booking API (e2e)', () => {
  let app: INestApplication;

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
  });

  afterAll(async () => {
    await app.close();
  });

  it('/health (GET) - Service liveness probe', async () => {
    const res = await request.default(app.getHttpServer()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.service).toBe('app-turf-api');
    expect(res.body.data.environment).toBeDefined();
  });

  it('/health/db (GET) - Database readiness probe without exposing secrets', async () => {
    const res = await request.default(app.getHttpServer()).get('/health/db');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.database.name).toBe('turf_booking_db');
    expect(res.body.data.database.status).toBe('connected');
    expect(res.body.data.database.latencyMs).toBeGreaterThanOrEqual(0);
    expect(res.body.data.database.url).toBeUndefined();
    expect(res.body.data.database.password).toBeUndefined();
  });
});
