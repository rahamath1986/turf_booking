import { Module } from '@nestjs/common';
import { AvailabilityService } from './availability.service';
import { AvailabilityController } from './availability.controller';
import { OwnerAvailabilityController } from './owner-availability.controller';

@Module({
  controllers: [AvailabilityController, OwnerAvailabilityController],
  providers: [AvailabilityService],
  exports: [AvailabilityService],
})
export class AvailabilityModule {}
