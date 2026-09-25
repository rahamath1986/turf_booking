import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { PrismaService } from '../database/prisma.service';

describe('FavoritesService', () => {
  let service: FavoritesService;

  const mockPrisma = {
    favorite: {
      count: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
    turf: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FavoritesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<FavoritesService>(FavoritesService);
    jest.clearAllMocks();
  });

  describe('getFavorites', () => {
    it('should return paginated list of user favorites', async () => {
      mockPrisma.favorite.count.mockResolvedValue(1);
      mockPrisma.favorite.findMany.mockResolvedValue([
        {
          id: 'fav-1',
          createdAt: new Date(),
          turf: {
            id: 'turf-1',
            name: 'Arena Sports',
            slug: 'arena-sports',
            description: 'Top venue',
            addressLine: '123 Main St',
            city: { name: 'Bangalore' },
            area: { name: 'Koramangala' },
            ratingAverage: 4.8,
            totalReviews: 24,
            coverImageUrl: 'http://img.jpg',
            turfSports: [{ sport: { name: 'Cricket' } }],
            images: [],
            isActive: true,
          },
        },
      ]);

      const result = await service.getFavorites('user-1', 1, 10);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].turf.name).toBe('Arena Sports');
      expect(result.meta.total).toBe(1);
    });
  });

  describe('addFavorite', () => {
    it('should throw NotFoundException if turf does not exist', async () => {
      mockPrisma.turf.findFirst.mockResolvedValue(null);

      await expect(
        service.addFavorite('user-1', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should add turf to favorites successfully', async () => {
      mockPrisma.turf.findFirst.mockResolvedValue({
        id: 'turf-1',
        name: 'Arena Sports',
        slug: 'arena-sports',
      });
      mockPrisma.favorite.upsert.mockResolvedValue({
        id: 'fav-1',
        userId: 'user-1',
        turfId: 'turf-1',
        createdAt: new Date(),
        turf: { name: 'Arena Sports' },
      });

      const result = await service.addFavorite('user-1', 'turf-1');
      expect(result.message).toBe('Turf added to favorites');
      expect(result.favorite.turfId).toBe('turf-1');
    });
  });

  describe('removeFavorite', () => {
    it('should remove turf from favorites idempotently', async () => {
      mockPrisma.favorite.delete.mockResolvedValue({ id: 'fav-1' });

      const result = await service.removeFavorite('user-1', 'turf-1');
      expect(result.message).toBe('Turf removed from favorites');
      expect(mockPrisma.favorite.delete).toHaveBeenCalledWith({
        where: {
          userId_turfId: { userId: 'user-1', turfId: 'turf-1' },
        },
      });
    });

    it('should succeed even if favorite did not exist', async () => {
      mockPrisma.favorite.delete.mockRejectedValue(
        new Error('Record not found'),
      );

      const result = await service.removeFavorite('user-1', 'turf-999');
      expect(result.message).toBe('Turf removed from favorites');
    });
  });
});
