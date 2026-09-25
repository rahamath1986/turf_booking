import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserCount() {
    const count = await this.prisma.user.count({
      where: { deletedAt: null },
    });
    return { count };
  }
}
