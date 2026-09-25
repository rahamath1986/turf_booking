import { Injectable } from '@nestjs/common';
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
}
