// Auto-deploy trigger
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port', 3000);
  const apiPrefix = configService.get<string>('apiPrefix', 'api/v1');
  const corsOrigins = configService.get<string[]>('corsOrigins', [
    'http://localhost:3000',
  ]);

  // Security Headers
  app.use(
    helmet({
      contentSecurityPolicy:
        process.env.NODE_ENV === 'production' ? undefined : false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  // Response Compression
  app.use(compression());

  // CORS Configuration
  app.enableCors({
    origin: corsOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-Correlation-Id',
      'X-Idempotency-Key',
    ],
  });

  // Enable Graceful Shutdown Hooks
  app.enableShutdownHooks();

  // Global Prefix with Health Check Exclusions
  app.setGlobalPrefix(apiPrefix, {
    exclude: ['health', 'health/db'],
  });

  // Global Interceptors & Filters
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TransformInterceptor(),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  // Strict Request Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger / OpenAPI Specification Setup
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Turf Booking Platform API')
    .setDescription(
      'Production-grade RESTful API for Multi-Turf Sports Booking Platform.\n\n' +
        '### Core Architecture Highlights:\n' +
        '- **Multi-Tenant Isolation**: Supports multiple owners, turfs, sports, and court pitches.\n' +
        '- **High Concurrency Engine**: Slot holds with locking, TTL expiration, and idempotency.\n' +
        '- **Azure Multi-Product Compatible**: Dedicated logical database `turf_booking_db`.\n' +
        '- **Strict RBAC**: Role-based access control for SUPER_ADMIN, ADMIN, TURF_OWNER, MANAGER, STAFF, and CUSTOMER.',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter your JWT Bearer token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('Health', 'System liveness and database readiness probes')
    .addTag('Auth', 'Authentication, JWT token rotation, and RBAC')
    .addTag('Users', 'User directory and profiles')
    .addTag('Locations', 'Operational cities and regional configurations')
    .addTag('Sports', 'Sports catalog and game types')
    .addTag('Facilities', 'Facility amenities and venue infrastructure')
    .addTag('Turfs', 'Turf venue management and discovery')
    .addTag('Availability', 'Slot availability and hold engine')
    .addTag('Bookings', 'Booking lifecycle and check-in')
    .addTag('Payments', 'Server-side payment verification and webhooks')
    .addTag('Notifications', 'Push, SMS, and Email alert channels')
    .addTag('Reviews', 'Verified customer ratings and reviews')
    .addTag('Owners', 'Turf owner profiles and management')
    .addTag('Admin', 'Platform administration and statistics')
    .addTag('Uploads', 'Azure Blob Storage file upload metadata')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  await app.listen(port);
  logger.log(`🚀 Application listening on: http://localhost:${port}`);
  logger.log(
    `📚 OpenAPI / Swagger documentation: http://localhost:${port}/api/docs`,
  );
  logger.log(`💓 Health endpoint: http://localhost:${port}/health`);
}

void bootstrap();
