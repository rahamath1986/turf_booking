import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { DatabaseModule } from '../database/database.module';
import { AvailabilityModule } from '../availability/availability.module';
import { UploadsModule } from '../uploads/uploads.module';
import { ReviewsModule } from '../reviews/reviews.module';

@Module({
  imports: [DatabaseModule, AvailabilityModule, UploadsModule, ReviewsModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
