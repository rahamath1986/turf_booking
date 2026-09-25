import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class SportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getActiveSports() {
    return this.prisma.sport.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }
}
