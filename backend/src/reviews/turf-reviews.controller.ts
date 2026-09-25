import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewQueryDto } from './dto/review-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Turf Reviews')
@Controller('turfs/:id/reviews')
export class TurfReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all reviews for a turf venue',
    description:
      'Returns paginated reviews along with aggregate star rating distribution for the turf.',
  })
  @ApiResponse({ status: 200, description: 'Turf reviews and rating summary' })
  @ApiResponse({ status: 404, description: 'Turf venue not found' })
  getTurfReviews(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ReviewQueryDto,
  ) {
    return this.reviewsService.getTurfReviews(id, query);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Submit a review for a turf venue',
    description:
      'Creates a verified customer review and recalculates the average rating for the turf.',
  })
  @ApiResponse({ status: 201, description: 'Review submitted successfully' })
  @ApiResponse({ status: 404, description: 'Turf venue not found' })
  createReview(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.createReview(id, userId, dto);
  }
}
