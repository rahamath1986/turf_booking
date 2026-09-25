import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class FavoritesService {
  private readonly logger = new Logger(FavoritesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /api/v1/favorites
   * List authenticated user's favorite turfs with full venue details
   */
  async getFavorites(userId: string, page = 1, limit = 20) {
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [total, favorites] = await Promise.all([
      this.prisma.favorite.count({
        where: { userId },
      }),
      this.prisma.favorite.findMany({
        where: { userId },
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          turf: {
            include: {
              city: { select: { id: true, name: true, slug: true } },
              area: { select: { id: true, name: true } },
              images: {
                select: {
                  id: true,
                  imageUrl: true,
                  isCover: true,
                  displayOrder: true,
                },
                orderBy: { displayOrder: 'asc' },
              },
              turfSports: {
                include: {
                  sport: {
                    select: { id: true, name: true, slug: true, iconUrl: true },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    const items = favorites.map((fav) => ({
      favoriteId: fav.id,
      favoritedAt: fav.createdAt,
      turf: {
        id: fav.turf.id,
        name: fav.turf.name,
        slug: fav.turf.slug,
        description: fav.turf.description,
        addressLine: fav.turf.addressLine,
        city: fav.turf.city?.name,
        area: fav.turf.area?.name,
        ratingAverage: Number(fav.turf.ratingAverage),
        totalReviews: fav.turf.totalReviews,
        coverImageUrl: fav.turf.coverImageUrl,
        sports: fav.turf.turfSports.map((ts) => ts.sport.name),
        images: fav.turf.images,
        isActive: fav.turf.isActive,
      },
    }));

    return {
      items,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  /**
   * POST /api/v1/favorites/:turfId
   * Add a turf to user's favorites
   */
  async addFavorite(userId: string, turfId: string) {
    // Verify turf exists and is not soft deleted
    const turf = await this.prisma.turf.findFirst({
      where: {
        id: turfId,
        deletedAt: null,
      },
      select: { id: true, name: true, slug: true },
    });

    if (!turf) {
      throw new NotFoundException(`Turf venue with ID '${turfId}' not found`);
    }

    const favorite = await this.prisma.favorite.upsert({
      where: {
        userId_turfId: {
          userId,
          turfId,
        },
      },
      update: {},
      create: {
        userId,
        turfId,
      },
      include: {
        turf: {
          select: {
            id: true,
            name: true,
            slug: true,
            coverImageUrl: true,
            ratingAverage: true,
            totalReviews: true,
          },
        },
      },
    });

    this.logger.log(`User ${userId} favorited turf ${turfId}`);

    return {
      message: 'Turf added to favorites',
      favorite: {
        id: favorite.id,
        turfId: favorite.turfId,
        turfName: favorite.turf.name,
        favoritedAt: favorite.createdAt,
      },
    };
  }

  /**
   * DELETE /api/v1/favorites/:turfId
   * Remove a turf from user's favorites
   */
  async removeFavorite(userId: string, turfId: string) {
    try {
      await this.prisma.favorite.delete({
        where: {
          userId_turfId: {
            userId,
            turfId,
          },
        },
      });
      this.logger.log(`User ${userId} unfavorited turf ${turfId}`);
    } catch {
      // If already deleted or not existing, remain idempotent
      this.logger.debug(
        `User ${userId} attempted to unfavorite non-existent favorite ${turfId}`,
      );
    }

    return {
      message: 'Turf removed from favorites',
    };
  }
}
