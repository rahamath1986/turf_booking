import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class FacilitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async getStandardAmenities() {
    return this.prisma.facility.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }
}
