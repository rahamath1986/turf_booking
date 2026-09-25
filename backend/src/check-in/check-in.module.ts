import { Module } from '@nestjs/common';
import { CheckInService } from './check-in.service';
import { BookingsCheckInController } from './bookings-check-in.controller';
import { StaffBookingsController } from './staff-bookings.controller';

@Module({
  controllers: [BookingsCheckInController, StaffBookingsController],
  providers: [CheckInService],
  exports: [CheckInService],
})
export class CheckInModule {}
