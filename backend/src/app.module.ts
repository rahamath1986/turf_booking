import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { LocationsModule } from './locations/locations.module';
import { SportsModule } from './sports/sports.module';
import { FacilitiesModule } from './facilities/facilities.module';
import { TurfsModule } from './turfs/turfs.module';
import { AvailabilityModule } from './availability/availability.module';
import { BookingsModule } from './bookings/bookings.module';
import { PaymentsModule } from './payments/payments.module';
import { RefundsModule } from './refunds/refunds.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ReviewsModule } from './reviews/reviews.module';
import { FavoritesModule } from './favorites/favorites.module';
import { CouponsModule } from './coupons/coupons.module';
import { OwnersModule } from './owners/owners.module';
import { CheckInModule } from './check-in/check-in.module';
import { AdminModule } from './admin/admin.module';
import { CommissionModule } from './commission/commission.module';
import { UploadsModule } from './uploads/uploads.module';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      cache: true,
    }),

    // Rate Limiting / DoS Protection
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('throttler.ttl', 60000),
          limit: config.get<number>('throttler.limit', 100),
        },
      ],
    }),

    // Core Infrastructure
    DatabaseModule,
    HealthModule,

    // Domain Modules
    AuthModule,
    UsersModule,
    LocationsModule,
    SportsModule,
    FacilitiesModule,
    TurfsModule,
    AvailabilityModule,
    BookingsModule,
    PaymentsModule,
    RefundsModule,
    NotificationsModule,
    ReviewsModule,
    FavoritesModule,
    CouponsModule,
    OwnersModule,
    CheckInModule,
    AdminModule,
    CommissionModule,
    UploadsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('(.*)');
  }
}
