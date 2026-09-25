import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { PrismaService } from '../database/prisma.service';

describe('ReviewsService', () => {
  let service: ReviewsService;

  const mockPrisma = {
    turf: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    booking: {
      findFirst: jest.fn(),
    },
    review: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
    jest.clearAllMocks();
  });

  describe('getTurfReviews', () => {
    it('should throw NotFoundException if turf does not exist', async () => {
      mockPrisma.turf.findFirst.mockResolvedValue(null);

      await expect(
        service.getTurfReviews('turf-none', { page: 1, limit: 10 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return review summary and paginated items', async () => {
      mockPrisma.turf.findFirst.mockResolvedValue({
        id: 'turf-1',
        name: 'Turf City',
        ratingAverage: 4.5,
        totalReviews: 2,
      });
      mockPrisma.review.count.mockResolvedValue(2);
      mockPrisma.review.findMany.mockResolvedValue([
        {
          id: 'rev-1',
          rating: 5,
          comment: 'Super turf',
          user: { id: 'u-1', fullName: 'John Doe', avatarUrl: null },
          ownerReply: null,
          ownerRepliedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      mockPrisma.review.groupBy.mockResolvedValue([
        { rating: 5, _count: { id: 2 } },
      ]);

      const res = await service.getTurfReviews('turf-1', {
        page: 1,
        limit: 10,
      });
      expect(res.summary.averageRating).toBe(4.5);
      expect(res.summary.ratingDistribution[5]).toBe(2);
      expect(res.items).toHaveLength(1);
    });
  });

  describe('createReview', () => {
    it('should throw NotFoundException if turf not found', async () => {
      mockPrisma.turf.findFirst.mockResolvedValue(null);

      await expect(
        service.createReview('turf-none', 'u-1', {
          rating: 5,
          comment: 'Nice',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if bookingId is invalid or does not belong to user', async () => {
      mockPrisma.turf.findFirst.mockResolvedValue({ id: 'turf-1' });
      mockPrisma.booking.findFirst.mockResolvedValue(null);

      await expect(
        service.createReview('turf-1', 'u-1', {
          rating: 4,
          bookingId: '123e4567-e89b-12d3-a456-426614174000',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create review and recalculate turf rating', async () => {
      mockPrisma.turf.findFirst.mockResolvedValue({ id: 'turf-1' });
      mockPrisma.review.create.mockResolvedValue({
        id: 'rev-1',
        turfId: 'turf-1',
        rating: 5,
        comment: 'Brilliant surface',
        bookingId: null,
        createdAt: new Date(),
        user: { id: 'u-1', fullName: 'Alice' },
      });
      mockPrisma.review.aggregate.mockResolvedValue({
        _avg: { rating: 5.0 },
        _count: { id: 1 },
      });
      mockPrisma.turf.update.mockResolvedValue({});

      const res = await service.createReview('turf-1', 'u-1', {
        rating: 5,
        comment: 'Brilliant surface',
      });

      expect(res.message).toBe('Review submitted successfully');
      expect(res.review.rating).toBe(5);
      expect(mockPrisma.turf.update).toHaveBeenCalledWith({
        where: { id: 'turf-1' },
        data: { totalReviews: 1, ratingAverage: 5 },
      });
    });
  });

  describe('updateReview', () => {
    it('should throw ForbiddenException if user is not author and not admin', async () => {
      mockPrisma.review.findUnique.mockResolvedValue({
        id: 'rev-1',
        userId: 'other-user',
        turfId: 'turf-1',
      });

      await expect(
        service.updateReview('rev-1', 'attacker-id', ['CUSTOMER'], {
          rating: 3,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should update review if author', async () => {
      mockPrisma.review.findUnique.mockResolvedValue({
        id: 'rev-1',
        userId: 'author-id',
        turfId: 'turf-1',
      });
      mockPrisma.review.update.mockResolvedValue({
        id: 'rev-1',
        turfId: 'turf-1',
        rating: 4,
        comment: 'Updated',
        user: { id: 'author-id', fullName: 'Author' },
      });
      mockPrisma.review.aggregate.mockResolvedValue({
        _avg: { rating: 4.0 },
        _count: { id: 1 },
      });
      mockPrisma.turf.update.mockResolvedValue({});

      const res = await service.updateReview(
        'rev-1',
        'author-id',
        ['CUSTOMER'],
        {
          rating: 4,
          comment: 'Updated',
        },
      );

      expect(res.message).toBe('Review updated successfully');
      expect(res.review.rating).toBe(4);
    });
  });

  describe('deleteReview', () => {
    it('should delete review and recalculate turf ratings', async () => {
      mockPrisma.review.findUnique.mockResolvedValue({
        id: 'rev-1',
        userId: 'author-id',
        turfId: 'turf-1',
      });
      mockPrisma.review.delete.mockResolvedValue({});
      mockPrisma.review.aggregate.mockResolvedValue({
        _avg: { rating: null },
        _count: { id: 0 },
      });
      mockPrisma.turf.update.mockResolvedValue({});

      const res = await service.deleteReview('rev-1', 'author-id', [
        'CUSTOMER',
      ]);
      expect(res.message).toBe('Review deleted successfully');
      expect(mockPrisma.review.delete).toHaveBeenCalledWith({
        where: { id: 'rev-1' },
      });
    });
  });

  describe('replyToReview', () => {
    it('should throw ForbiddenException if user is not turf owner', async () => {
      mockPrisma.review.findUnique.mockResolvedValue({
        id: 'rev-1',
        turf: {
          owner: { userId: 'real-owner-id' },
        },
      });

      await expect(
        service.replyToReview('rev-1', 'impostor-id', ['CUSTOMER'], {
          reply: 'Thank you',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow turf owner to reply', async () => {
      mockPrisma.review.findUnique.mockResolvedValue({
        id: 'rev-1',
        turfId: 'turf-1',
        turf: {
          owner: { userId: 'real-owner-id' },
        },
      });
      mockPrisma.review.update.mockResolvedValue({
        id: 'rev-1',
        turfId: 'turf-1',
        rating: 5,
        comment: 'Great',
        ownerReply: 'Thank you for your visit!',
        ownerRepliedAt: new Date(),
        user: { id: 'u-1', fullName: 'User' },
      });

      const res = await service.replyToReview(
        'rev-1',
        'real-owner-id',
        ['TURF_OWNER'],
        {
          reply: 'Thank you for your visit!',
        },
      );

      expect(res.message).toBe('Reply posted successfully');
      expect(res.review.ownerReply).toBe('Thank you for your visit!');
    });
  });
});
