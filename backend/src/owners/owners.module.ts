import { Module } from '@nestjs/common';
import { OwnersService } from './owners.service';
import { OwnersController } from './owners.controller';
import { OwnersDashboardController } from './owners-dashboard.controller';
import { OwnerBookingsController } from './owner-bookings.controller';

@Module({
  controllers: [
    OwnersController,
    OwnersDashboardController,
    OwnerBookingsController,
  ],
  providers: [OwnersService],
  exports: [OwnersService],
})
export class OwnersModule {}
