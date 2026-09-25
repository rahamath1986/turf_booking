import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { PrismaService } from '../database/prisma.service';
import { ConfigService } from '@nestjs/config';

describe('HealthController', () => {
  let controller: HealthController;
  let healthService: HealthService;

  const mockPrismaService = {
    isHealthy: jest.fn().mockResolvedValue({
      status: 'connected',
      latencyMs: 5,
    }),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      if (key === 'appName') return 'app-turf-api';
      if (key === 'nodeEnv') return 'test';
      return defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    healthService = module.get<HealthService>(HealthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
    expect(healthService).toBeDefined();
  });

  it('GET /health - should return service liveness status', () => {
    const result = controller.check();
    expect(result.status).toBe('ok');
    expect(result.service).toBe('app-turf-api');
    expect(result.environment).toBe('test');
    expect(result.version).toBe('1.0.0');
    expect(result.uptime).toBeDefined();
    expect(result.timestamp).toBeDefined();
  });

  it('GET /health/db - should return database readiness without exposing secrets', async () => {
    const result = await controller.checkDb();
    expect(result.status).toBe('ok');
    expect(result.database.name).toBe('turf_booking_db');
    expect(result.database.status).toBe('connected');
    expect(result.database.latencyMs).toBe(5);
    // Verify no credentials or connection string exposed
    expect((result as any).database.url).toBeUndefined();
    expect((result as any).database.password).toBeUndefined();
    expect((result as any).database.user).toBeUndefined();
  });
});
