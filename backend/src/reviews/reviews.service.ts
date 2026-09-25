import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { ReplyReviewDto } from './dto/reply-review.dto';
import { ReviewQueryDto } from './dto/review-query.dto';

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /api/v1/turfs/:id/reviews
   * Public retrieval of turf reviews with rating distribution statistics
   */
  async getTurfReviews(turfId: string, query: ReviewQueryDto) {
    const turf = await this.prisma.turf.findFirst({
      where: { id: turfId, deletedAt: null },
      select: { id: true, name: true, ratingAverage: true, totalReviews: true },
    });

    if (!turf) {
      throw new NotFoundException(`Turf venue with ID '${turfId}' not found`);
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const whereClause: any = { turfId };
    if (query.rating) {
      whereClause.rating = Number(query.rating);
    }

    const [total, reviews, allRatings] = await Promise.all([
      this.prisma.review.count({ where: whereClause }),
      this.prisma.review.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, fullName: true, avatarUrl: true },
          },
        },
      }),
      // Aggregate rating distribution for all reviews of this turf
      this.prisma.review.groupBy({
        by: ['rating'],
        where: { turfId },
        _count: { id: true },
      }),
    ]);

    const ratingDistribution: Record<number, number> = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };
    for (const group of allRatings) {
      ratingDistribution[group.rating] = group._count.id;
    }

    return {
      summary: {
        turfId: turf.id,
        turfName: turf.name,
        averageRating: Number(turf.ratingAverage),
        totalReviews: turf.totalReviews,
        ratingDistribution,
      },
      items: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        bookingId: r.bookingId,
        ownerReply: r.ownerReply,
        ownerRepliedAt: r.ownerRepliedAt,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        user: {
          id: r.user.id,
          fullName: r.user.fullName,
          avatarUrl: r.user.avatarUrl,
        },
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * POST /api/v1/turfs/:id/reviews
   * Authenticated user creates a new review for a turf
   */
  async createReview(turfId: string, userId: string, dto: CreateReviewDto) {
    const turf = await this.prisma.turf.findFirst({
      where: { id: turfId, deletedAt: null },
    });

    if (!turf) {
      throw new NotFoundException(`Turf venue with ID '${turfId}' not found`);
    }

    // Optional booking verification
    if (dto.bookingId) {
      const booking = await this.prisma.booking.findFirst({
        where: {
          id: dto.bookingId,
          turfId,
          userId,
        },
      });

      if (!booking) {
        throw new BadRequestException(
          'Specified booking does not belong to you or does not match this turf venue',
        );
      }
    }

    const review = await this.prisma.review.create({
      data: {
        userId,
        turfId,
        bookingId: dto.bookingId || null,
        rating: dto.rating,
        comment: dto.comment || null,
      },
      include: {
        user: {
          select: { id: true, fullName: true, avatarUrl: true },
        },
      },
    });

    // Recalculate turf ratings
    await this.syncTurfRating(turfId);

    this.logger.log(
      `Created review ${review.id} for turf ${turfId} by user ${userId}`,
    );

    return {
      message: 'Review submitted successfully',
      review: {
        id: review.id,
        turfId: review.turfId,
        rating: review.rating,
        comment: review.comment,
        bookingId: review.bookingId,
        createdAt: review.createdAt,
        user: review.user,
      },
    };
  }

  /**
   * PUT /api/v1/reviews/:id
   * Update an existing review (Author or Admin)
   */
  async updateReview(
    reviewId: string,
    userId: string,
    userRoles: string[] = [],
    dto: UpdateReviewDto,
  ) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      include: {
        user: { select: { id: true, fullName: true, avatarUrl: true } },
      },
    });

    if (!review) {
      throw new NotFoundException(`Review with ID '${reviewId}' not found`);
    }

    const isAdmin =
      userRoles.includes('ADMIN') || userRoles.includes('SUPER_ADMIN');
    if (review.userId !== userId && !isAdmin) {
      throw new ForbiddenException(
        'You are not authorized to update this review',
      );
    }

    const updated = await this.prisma.review.update({
      where: { id: reviewId },
      data: {
        ...(dto.rating !== undefined ? { rating: dto.rating } : {}),
        ...(dto.comment !== undefined ? { comment: dto.comment } : {}),
      },
      include: {
        user: { select: { id: true, fullName: true, avatarUrl: true } },
      },
    });

    if (dto.rating !== undefined) {
      await this.syncTurfRating(review.turfId);
    }

    return {
      message: 'Review updated successfully',
      review: {
        id: updated.id,
        turfId: updated.turfId,
        rating: updated.rating,
        comment: updated.comment,
        ownerReply: updated.ownerReply,
        ownerRepliedAt: updated.ownerRepliedAt,
        updatedAt: updated.updatedAt,
        user: updated.user,
      },
    };
  }

  /**
   * DELETE /api/v1/reviews/:id
   * Delete an existing review (Author or Admin)
   */
  async deleteReview(
    reviewId: string,
    userId: string,
    userRoles: string[] = [],
  ) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException(`Review with ID '${reviewId}' not found`);
    }

    const isAdmin =
      userRoles.includes('ADMIN') || userRoles.includes('SUPER_ADMIN');
    if (review.userId !== userId && !isAdmin) {
      throw new ForbiddenException(
        'You are not authorized to delete this review',
      );
    }

    await this.prisma.review.delete({
      where: { id: reviewId },
    });

    await this.syncTurfRating(review.turfId);

    return {
      message: 'Review deleted successfully',
    };
  }

  /**
   * POST /api/v1/reviews/:id/reply
   * Turf Owner replies to a customer review
   */
  async replyToReview(
    reviewId: string,
    userId: string,
    userRoles: string[] = [],
    dto: ReplyReviewDto,
  ) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      include: {
        turf: {
          include: {
            owner: true,
          },
        },
      },
    });

    if (!review) {
      throw new NotFoundException(`Review with ID '${reviewId}' not found`);
    }

    const isAdmin =
      userRoles.includes('ADMIN') || userRoles.includes('SUPER_ADMIN');
    const isOwner = review.turf.owner?.userId === userId;

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException(
        'Only the verified turf owner or platform administrator can reply to this review',
      );
    }

    const updated = await this.prisma.review.update({
      where: { id: reviewId },
      data: {
        ownerReply: dto.reply,
        ownerRepliedAt: new Date(),
      },
      include: {
        user: { select: { id: true, fullName: true, avatarUrl: true } },
      },
    });

    this.logger.log(`Owner ${userId} replied to review ${reviewId}`);

    return {
      message: 'Reply posted successfully',
      review: {
        id: updated.id,
        turfId: updated.turfId,
        rating: updated.rating,
        comment: updated.comment,
        ownerReply: updated.ownerReply,
        ownerRepliedAt: updated.ownerRepliedAt,
        user: updated.user,
      },
    };
  }

  /**
   * Helper to recalculate average rating and total reviews for a turf
   */
  private async syncTurfRating(turfId: string) {
    const agg = await this.prisma.review.aggregate({
      where: { turfId },
      _avg: { rating: true },
      _count: { id: true },
    });

    const totalReviews = agg._count.id;
    const ratingAverage = agg._avg.rating
      ? Number(agg._avg.rating.toFixed(2))
      : 0;

    await this.prisma.turf.update({
      where: { id: turfId },
      data: {
        totalReviews,
        ratingAverage,
      },
    });
  }
}
