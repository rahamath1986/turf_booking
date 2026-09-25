import {
  Controller,
  Put,
  Delete,
  Post,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { UpdateReviewDto } from './dto/update-review.dto';
import { ReplyReviewDto } from './dto/reply-review.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Reviews')
@Controller('reviews')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Put(':id')
  @ApiOperation({
    summary: 'Update an existing review',
    description:
      'Allows the review author or administrator to update rating and comments.',
  })
  @ApiResponse({ status: 200, description: 'Review updated successfully' })
  @ApiResponse({
    status: 403,
    description: 'Not authorized to update this review',
  })
  @ApiResponse({ status: 404, description: 'Review not found' })
  updateReview(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('roles') userRoles: string[],
    @Body() dto: UpdateReviewDto,
  ) {
    return this.reviewsService.updateReview(id, userId, userRoles, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a review',
    description:
      'Deletes a review and recalculates the average rating for the venue.',
  })
  @ApiResponse({ status: 200, description: 'Review deleted successfully' })
  @ApiResponse({
    status: 403,
    description: 'Not authorized to delete this review',
  })
  @ApiResponse({ status: 404, description: 'Review not found' })
  deleteReview(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('roles') userRoles: string[],
  ) {
    return this.reviewsService.deleteReview(id, userId, userRoles);
  }

  @Post(':id/reply')
  @ApiOperation({
    summary: 'Owner reply to review',
    description:
      'Enables verified turf owners to post a direct public response to a customer review.',
  })
  @ApiResponse({ status: 200, description: 'Reply posted successfully' })
  @ApiResponse({
    status: 403,
    description: 'Only turf owner can reply to this review',
  })
  @ApiResponse({ status: 404, description: 'Review not found' })
  replyToReview(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('roles') userRoles: string[],
    @Body() dto: ReplyReviewDto,
  ) {
    return this.reviewsService.replyToReview(id, userId, userRoles, dto);
  }
}
