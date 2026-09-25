import { Module } from '@nestjs/common';
import { ReviewsController } from './reviews.controller';
import { TurfReviewsController } from './turf-reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  controllers: [ReviewsController, TurfReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
