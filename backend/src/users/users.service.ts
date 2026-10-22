import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserCount() {
    const count = await this.prisma.user.count({
      where: { deletedAt: null },
    });
    return { count };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        email: true,
        phone: true,
        fullName: true,
        avatarUrl: true,
        createdAt: true,
        roles: {
          select: {
            role: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      roles: user.roles.map((r) => r.role.name),
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    if (dto.phone) {
      const existingPhone = await this.prisma.user.findFirst({
        where: {
          phone: dto.phone,
          id: { not: userId },
          deletedAt: null,
        },
      });
      if (existingPhone) {
        throw new ConflictException('Phone number is already associated with another account');
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.fullName !== undefined && { fullName: dto.fullName.trim() }),
        ...(dto.phone !== undefined && { phone: dto.phone.trim() }),
        ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl.trim() }),
      },
      select: {
        id: true,
        email: true,
        phone: true,
        fullName: true,
        avatarUrl: true,
        createdAt: true,
        roles: {
          select: {
            role: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      phone: updatedUser.phone,
      fullName: updatedUser.fullName,
      avatarUrl: updatedUser.avatarUrl,
      createdAt: updatedUser.createdAt,
      roles: updatedUser.roles.map((r) => r.role.name),
    };
  }

  async deleteAccount(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException("User profile not found or already deleted");
    }

    // 1. Soft delete the user
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });

    // 2. Revoke and invalidate all active refresh tokens/sessions
    await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });

    // 3. Unregister all user push devices
    await this.prisma.userDevice.deleteMany({
      where: { userId },
    });

    return {
      success: true,
      message: "Account and associated data deleted successfully",
    };
  }
}
