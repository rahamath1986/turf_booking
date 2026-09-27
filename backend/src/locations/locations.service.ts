import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getActiveCities() {
    return this.prisma.city.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async getAreasByCity(cityIdOrSlug: string) {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        cityIdOrSlug,
      );

    const city = await this.prisma.city.findFirst({
      where: {
        ...(isUuid ? { id: cityIdOrSlug } : { slug: cityIdOrSlug }),
        isActive: true,
      },
    });

    if (!city) {
      throw new NotFoundException(
        `City with ID or slug '${cityIdOrSlug}' not found`,
      );
    }

    return this.prisma.area.findMany({
      where: {
        cityId: city.id,
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });
  }
}
