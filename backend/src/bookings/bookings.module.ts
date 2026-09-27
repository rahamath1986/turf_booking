import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { BookingHoldsController } from './booking-holds.controller';
import { AvailabilityModule } from '../availability/availability.module';
import { RefundsModule } from '../refunds/refunds.module';
import { CouponsModule } from '../coupons/coupons.module';

@Module({
  imports: [AvailabilityModule, RefundsModule, CouponsModule],
  controllers: [BookingsController, BookingHoldsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
