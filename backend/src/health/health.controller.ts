import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({
    summary: 'Service liveness check',
    description:
      'Returns the operational health, uptime, and service identity.',
  })
  @ApiResponse({
    status: 200,
    description: 'Service is operational',
    schema: {
      example: {
        success: true,
        statusCode: 200,
        data: {
          status: 'ok',
          service: 'app-turf-api',
          environment: 'development',
          version: '1.0.0',
          uptime: 42,
          timestamp: '2026-09-24T17:00:00.000Z',
        },
        timestamp: '2026-09-24T17:00:00.000Z',
      },
    },
  })
  check() {
    return this.healthService.getLiveness();
  }

  @Get('db')
  @ApiOperation({
    summary: 'Database readiness probe',
    description:
      'Pings the isolated PostgreSQL database (turf_booking_db) without exposing credentials.',
  })
  @ApiResponse({
    status: 200,
    description: 'Database connectivity verified',
    schema: {
      example: {
        success: true,
        statusCode: 200,
        data: {
          status: 'ok',
          database: {
            name: 'turf_booking_db',
            status: 'connected',
            latencyMs: 3,
          },
          timestamp: '2026-09-24T17:00:00.000Z',
        },
        timestamp: '2026-09-24T17:00:00.000Z',
      },
    },
  })
  async checkDb() {
    return this.healthService.getReadiness();
  }
}
