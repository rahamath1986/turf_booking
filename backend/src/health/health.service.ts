import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  getLiveness() {
    return {
      status: 'ok',
      service: this.configService.get<string>('appName', 'app-turf-api'),
      environment: this.configService.get<string>('nodeEnv', 'development'),
      version: '1.0.0',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  async getReadiness() {
    const dbHealth = await this.prisma.isHealthy();

    return {
      status: dbHealth.status === 'connected' ? 'ok' : 'degraded',
      database: {
        name: 'turf_booking_db',
        status: dbHealth.status,
        latencyMs: dbHealth.latencyMs,
      },
      timestamp: new Date().toISOString(),
    };
  }
}
