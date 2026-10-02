import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma, BookingStatus, RefundStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { Role } from '../common/enums/role.enum';
import {
  AdminCreateOwnerDto,
  AdminUpdateOwnerDto,
} from './dto/admin-owner.dto';
import { AdminCreateUserDto } from './dto/admin-user.dto';
import {
  AdminAddTurfImageDto,
  AdminCreateBookingDto,
  AdminCreateTurfDto,
  AdminUpdateTurfDto,
} from './dto/admin-turf.dto';
import {
  AdminCreateFacilityDto,
  AdminCreateSportDto,
  AdminUpdateFacilityDto,
  AdminUpdateSportDto,
} from './dto/admin-catalog.dto';
import {
  AdminCreateAreaDto,
  AdminCreateCityDto,
  AdminCreateCountryDto,
  AdminCreateStateDto,
  AdminUpdateAreaDto,
  AdminUpdateCityDto,
  AdminUpdateCountryDto,
  AdminUpdateStateDto,
} from './dto/admin-location.dto';
import { SetAvailabilityDto } from '../availability/dto/set-operating-hours.dto';
import { BlockSlotDto } from '../availability/dto/block-slot.dto';
import { AvailabilityService } from '../availability/availability.service';
import { UploadsService } from '../uploads/uploads.service';
import { ReviewsService } from '../reviews/reviews.service';
import { generateBookingNumber } from '../common/utils/booking-number.util';

// ============================================================================
// QUERY DTOs (inline for admin module)
// ============================================================================

export interface PaginatedQuery {
  page?: number;
  limit?: number;
  search?: string;
}

export interface UserAdminQuery extends PaginatedQuery {
  isActive?: boolean;
  role?: string;
}

export interface OwnerAdminQuery extends PaginatedQuery {
  isVerified?: boolean;
  isActive?: boolean;
}

export interface TurfAdminQuery extends PaginatedQuery {
  isApproved?: boolean;
  isActive?: boolean;
  cityId?: string;
}

export interface BookingAdminQuery extends PaginatedQuery {
  status?: BookingStatus;
  turfId?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
}

export interface ReportQuery {
  startDate?: string;
  endDate?: string;
  groupBy?: 'day' | 'week' | 'month';
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly availabilityService: AvailabilityService,
    private readonly uploadsService: UploadsService,
    private readonly reviewsService: ReviewsService,
  ) {}

  // ============================================================================
  // PLATFORM STATS
  // ============================================================================

  async getPlatformStats() {
    const [
      usersCount,
      turfsCount,
      sportsCount,
      citiesCount,
      bookingsCount,
      activeBookings,
      totalRevenue,
      pendingOwners,
      pendingTurfs,
      ownersCount,
      refundsAgg,
      pendingRefunds,
      pendingSettlements,
      activeCoupons,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.turf.count({ where: { deletedAt: null } }),
      this.prisma.sport.count({ where: { isActive: true } }),
      this.prisma.city.count({ where: { isActive: true } }),
      this.prisma.booking.count({ where: { deletedAt: null } }),
      this.prisma.booking.count({
        where: { status: BookingStatus.CONFIRMED, deletedAt: null },
      }),
      this.prisma.booking.aggregate({
        where: {
          status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
          deletedAt: null,
        },
        _sum: { totalPrice: true },
      }),
      // New owners default to unverified AND inactive, so pending = all
      // unverified (non-deleted) profiles awaiting admin approval.
      this.prisma.turfOwner.count({
        where: { isVerified: false, deletedAt: null },
      }),
      this.prisma.turf.count({
        where: { isApproved: false, isActive: true, deletedAt: null },
      }),
      this.prisma.turfOwner.count({ where: { deletedAt: null } }),
      this.prisma.refund.aggregate({
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.refund.count({ where: { status: RefundStatus.PENDING } }),
      this.prisma.settlement.count({
        where: { status: { in: ['PENDING', 'PROCESSING', 'ON_HOLD'] } },
      }),
      this.prisma.coupon.count({
        where: { isActive: true, endDate: { gt: new Date() } },
      }),
    ]);

    return {
      users: usersCount,
      turfs: turfsCount,
      sports: sportsCount,
      cities: citiesCount,
      bookings: { total: bookingsCount, active: activeBookings },
      totalRevenue: Number(totalRevenue._sum.totalPrice ?? 0),
      pendingApprovals: { owners: pendingOwners, turfs: pendingTurfs },
      owners: ownersCount,
      refunds: {
        total: refundsAgg._count,
        totalAmount: Number(refundsAgg._sum.amount ?? 0),
        pending: pendingRefunds,
      },
      pendingSettlements,
      activeCoupons,
      database: 'turf_booking_db',
    };
  }

  // ============================================================================
  // USER MANAGEMENT
  // ============================================================================

  async listUsers(query: UserAdminQuery) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = { deletedAt: null };

    if (query.isActive !== undefined) where.isActive = query.isActive;

    if (query.search) {
      const q = query.search.trim();
      where.OR = [
        { fullName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (query.role) {
      where.roles = {
        some: { role: { name: query.role } },
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          phone: true,
          fullName: true,
          avatarUrl: true,
          isActive: true,
          isEmailVerified: true,
          isPhoneVerified: true,
          createdAt: true,
          roles: { select: { role: { select: { name: true } } } },
          _count: { select: { bookings: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: items.map((u) => ({
        ...u,
        roles: u.roles.map((r) => r.role.name),
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async createUser(dto: AdminCreateUserDto, adminId: string) {
    const normalizedEmail = dto.email.toLowerCase().trim();

    const existingEmail = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingEmail)
      throw new ConflictException('Email address is already registered');

    if (dto.phone) {
      const existingPhone = await this.prisma.user.findUnique({
        where: { phone: dto.phone },
      });
      if (existingPhone)
        throw new ConflictException('Phone number is already registered');
    }

    const roleNames = dto.roles?.length ? [...new Set(dto.roles)] : [Role.CUSTOMER];
    const roleRecords = await this.prisma.role.findMany({
      where: { name: { in: roleNames } },
    });
    if (roleRecords.length !== roleNames.length) {
      const found = new Set(roleRecords.map((r) => r.name));
      const missing = roleNames.filter((r) => !found.has(r));
      throw new BadRequestException(
        `Unknown role(s): ${missing.join(', ')}. Run seed first.`,
      );
    }

    const passwordHash = await argon2.hash(dto.password);
    const fullName = dto.fullName.trim();

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: normalizedEmail,
          phone: dto.phone ?? null,
          fullName,
          passwordHash,
          isActive: dto.isActive ?? true,
          isEmailVerified: false,
          isPhoneVerified: false,
        },
      });

      await tx.userRole.createMany({
        data: roleRecords.map((r) => ({ userId: created.id, roleId: r.id })),
      });

      // Owners get an (unapproved, inactive) turf-owner profile so they show
      // up in the admin approval queue right away.
      if (roleNames.includes(Role.TURF_OWNER)) {
        await tx.turfOwner.create({
          data: {
            userId: created.id,
            businessName: `${fullName}'s Sports Arena`,
            isVerified: false,
            isActive: false,
          },
        });
      }

      return tx.user.findUniqueOrThrow({
        where: { id: created.id },
        select: {
          id: true,
          email: true,
          phone: true,
          fullName: true,
          avatarUrl: true,
          isActive: true,
          isEmailVerified: true,
          isPhoneVerified: true,
          createdAt: true,
          roles: { select: { role: { select: { name: true } } } },
        },
      });
    });

    this.logger.log(`Admin ${adminId} created user ${user.id}`);
    return { ...user, roles: user.roles.map((r) => r.role.name) };
  }

  async getUserById(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: {
        roles: { include: { role: true } },
        turfOwner: true,
        _count: {
          select: { bookings: true, reviews: true, favorites: true },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');

    const { passwordHash, ...safe } = user;
    return {
      ...safe,
      roles: user.roles.map((r) => r.role.name),
    };
  }

  async deleteUser(userId: string, adminId: string) {
    if (userId === adminId)
      throw new BadRequestException('You cannot delete your own account');
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: { turfOwner: { select: { id: true } } },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.turfOwner)
      throw new ConflictException(
        'User has an owner profile — suspend or delete the owner first',
      );
    const futureBookings = await this.prisma.booking.count({
      where: {
        userId,
        deletedAt: null,
        status: { in: [BookingStatus.CONFIRMED] },
      },
    });
    if (futureBookings > 0)
      throw new ConflictException(
        `User has ${futureBookings} active booking(s) — deactivate instead`,
      );

    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false, deletedAt: new Date() },
    });
    this.logger.log(`Admin ${adminId} soft-deleted user ${userId}`);
    return { message: 'User deleted successfully' };
  }

  async resetUserPassword(
    userId: string,
    newPassword: string,
    adminId: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user) throw new NotFoundException('User not found');
    if (newPassword.length < 8)
      throw new BadRequestException('Password must be at least 8 characters long');

    const passwordHash = await argon2.hash(newPassword);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    // Invalidate all sessions so only the new password works.
    await this.prisma.refreshToken.updateMany({
      where: { userId },
      data: { isRevoked: true },
    });
    this.logger.log(`Admin ${adminId} reset password for user ${userId}`);
    return { message: 'Password reset successfully. User must sign in again.' };
  }

  async updateUserStatus(userId: string, isActive: boolean, adminId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive },
    });

    this.logger.log(
      `Admin ${adminId} set user ${userId} isActive=${isActive}`,
    );
    return { message: `User ${isActive ? 'activated' : 'deactivated'} successfully` };
  }

  // ============================================================================
  // OWNER MANAGEMENT
  // ============================================================================

  async listOwners(query: OwnerAdminQuery) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.TurfOwnerWhereInput = { deletedAt: null };

    if (query.isVerified !== undefined) where.isVerified = query.isVerified;
    if (query.isActive !== undefined) where.isActive = query.isActive;

    if (query.search) {
      const q = query.search.trim();
      where.OR = [
        { businessName: { contains: q, mode: 'insensitive' } },
        { user: { email: { contains: q, mode: 'insensitive' } } },
        { user: { fullName: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.turfOwner.findMany({
        where,
        include: {
          user: {
            select: { id: true, email: true, fullName: true, phone: true, isActive: true },
          },
          _count: { select: { turfs: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.turfOwner.count({ where }),
    ]);

    return {
      items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getOwnerById(ownerId: string) {
    const owner = await this.prisma.turfOwner.findFirst({
      where: { id: ownerId, deletedAt: null },
      include: {
        user: {
          select: { id: true, email: true, fullName: true, phone: true, isActive: true, isEmailVerified: true },
        },
        turfs: {
          where: { deletedAt: null },
          select: { id: true, name: true, slug: true, isApproved: true, isActive: true },
        },
        commissionConfig: true,
      },
    });

    if (!owner) throw new NotFoundException('Owner not found');
    return owner;
  }

  async approveOwner(ownerId: string, adminId: string) {
    const owner = await this.prisma.turfOwner.findFirst({
      where: { id: ownerId, deletedAt: null },
    });
    if (!owner) throw new NotFoundException('Owner not found');
    if (owner.isVerified) throw new ConflictException('Owner is already verified');

    await this.prisma.turfOwner.update({
      where: { id: ownerId },
      data: { isVerified: true, isActive: true, rejectionReason: null },
    });

    this.logger.log(`Admin ${adminId} approved owner ${ownerId}`);
    return { message: 'Owner approved successfully' };
  }

  async rejectOwner(ownerId: string, reason: string, adminId: string) {
    const owner = await this.prisma.turfOwner.findFirst({
      where: { id: ownerId, deletedAt: null },
    });
    if (!owner) throw new NotFoundException('Owner not found');

    await this.prisma.turfOwner.update({
      where: { id: ownerId },
      data: { isVerified: false, isActive: false, rejectionReason: reason || null },
    });

    this.logger.log(`Admin ${adminId} rejected owner ${ownerId}: ${reason}`);
    return { message: 'Owner rejected' };
  }

  async suspendOwner(ownerId: string, reason: string, adminId: string) {
    const owner = await this.prisma.turfOwner.findFirst({
      where: { id: ownerId, deletedAt: null },
    });
    if (!owner) throw new NotFoundException('Owner not found');

    await this.prisma.turfOwner.update({
      where: { id: ownerId },
      data: { isActive: false },
    });

    this.logger.log(`Admin ${adminId} suspended owner ${ownerId}: ${reason}`);
    return { message: 'Owner suspended' };
  }

  async createOwner(dto: AdminCreateOwnerDto, adminId: string) {
    const normalizedEmail = dto.email.toLowerCase().trim();

    const existingEmail = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingEmail)
      throw new ConflictException('Email address is already registered');

    if (dto.phone) {
      const existingPhone = await this.prisma.user.findUnique({
        where: { phone: dto.phone },
      });
      if (existingPhone)
        throw new ConflictException('Phone number is already registered');
    }

    const roleRecord = await this.prisma.role.findUnique({
      where: { name: Role.TURF_OWNER },
    });
    if (!roleRecord)
      throw new BadRequestException(
        'TURF_OWNER role is not initialized in database. Run seed first.',
      );

    const passwordHash = await argon2.hash(dto.password);

    // Admin-created owners default to UNVERIFIED and INACTIVE unless the
    // admin explicitly opts them into verified/active at creation time.
    const owner = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          phone: dto.phone ?? null,
          fullName: dto.fullName.trim(),
          passwordHash,
          isActive: true,
          isEmailVerified: false,
          isPhoneVerified: false,
        },
      });

      await tx.userRole.create({
        data: { userId: user.id, roleId: roleRecord.id },
      });

      return tx.turfOwner.create({
        data: {
          userId: user.id,
          businessName:
            dto.businessName?.trim() || `${dto.fullName.trim()}'s Sports Arena`,
          legalName: dto.legalName?.trim() || null,
          panNumber: dto.panNumber?.trim() || null,
          gstNumber: dto.gstNumber?.trim() || null,
          bankAccountNumber: dto.bankAccountNumber?.trim() || null,
          bankIfsc: dto.bankIfsc?.trim() || null,
          bankName: dto.bankName?.trim() || null,
          isVerified: dto.isVerified ?? false,
          isActive: dto.isActive ?? false,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
              phone: true,
              isActive: true,
            },
          },
        },
      });
    });

    this.logger.log(`Admin ${adminId} created owner ${owner.id}`);
    return owner;
  }

  async updateOwner(
    ownerId: string,
    dto: AdminUpdateOwnerDto,
    adminId: string,
  ) {
    const owner = await this.prisma.turfOwner.findFirst({
      where: { id: ownerId, deletedAt: null },
    });
    if (!owner) throw new NotFoundException('Owner not found');

    if (dto.phone) {
      const existingPhone = await this.prisma.user.findUnique({
        where: { phone: dto.phone },
      });
      if (existingPhone && existingPhone.id !== owner.userId)
        throw new ConflictException('Phone number is already registered');
    }

    const profileData: Prisma.TurfOwnerUpdateInput = {};
    const profileKeys = [
      'businessName',
      'legalName',
      'panNumber',
      'gstNumber',
      'bankAccountNumber',
      'bankIfsc',
      'bankName',
      'isVerified',
      'isActive',
    ] as const;
    for (const key of profileKeys) {
      const value = dto[key];
      if (value === undefined) continue;
      if (typeof value === 'string') {
        const trimmed = value.trim();
        // businessName is required — ignore empty strings for it.
        if (key === 'businessName' && !trimmed) continue;
        (profileData as Record<string, unknown>)[key] = trimmed || null;
      } else {
        (profileData as Record<string, unknown>)[key] = value;
      }
    }

    const userData: Prisma.UserUpdateInput = {};
    if (dto.fullName !== undefined) userData.fullName = dto.fullName.trim();
    if (dto.phone !== undefined) userData.phone = dto.phone;

    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(profileData).length > 0) {
        await tx.turfOwner.update({ where: { id: ownerId }, data: profileData });
      }
      if (Object.keys(userData).length > 0) {
        await tx.user.update({ where: { id: owner.userId }, data: userData });
      }
    });

    this.logger.log(`Admin ${adminId} updated owner ${ownerId}`);
    return this.getOwnerById(ownerId);
  }

  async deleteOwner(ownerId: string, reason: string, adminId: string) {
    const owner = await this.prisma.turfOwner.findFirst({
      where: { id: ownerId, deletedAt: null },
    });
    if (!owner) throw new NotFoundException('Owner not found');

    // Soft delete: hide the profile, deactivate the login and all venues.
    // Financial history (bookings, commissions, settlements) is preserved.
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.turfOwner.update({
        where: { id: ownerId },
        data: { isActive: false, isVerified: false, deletedAt: now },
      });
      await tx.user.update({
        where: { id: owner.userId },
        data: { isActive: false },
      });
      await tx.turf.updateMany({
        where: { ownerId, deletedAt: null },
        data: { isActive: false },
      });
    });

    this.logger.log(`Admin ${adminId} deleted owner ${ownerId}: ${reason}`);
    return { message: 'Owner deleted successfully' };
  }

  // ============================================================================
  // TURF MANAGEMENT
  // ============================================================================

  async listTurfs(query: TurfAdminQuery) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.TurfWhereInput = { deletedAt: null };

    if (query.isApproved !== undefined) where.isApproved = query.isApproved;
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.cityId) where.cityId = query.cityId;

    if (query.search) {
      const q = query.search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { addressLine: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.turf.findMany({
        where,
        include: {
          owner: {
            select: { id: true, businessName: true, userId: true },
          },
          city: { select: { id: true, name: true } },
          _count: { select: { bookings: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.turf.count({ where }),
    ]);

    return {
      items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getTurfById(turfId: string) {
    const turf = await this.prisma.turf.findFirst({
      where: { id: turfId, deletedAt: null },
      include: {
        owner: { include: { user: { select: { email: true, fullName: true } } } },
        city: true,
        area: true,
        turfSports: { include: { sport: true } },
        turfFacilities: { include: { facility: true } },
        images: { orderBy: { displayOrder: 'asc' } },
        videos: { orderBy: { displayOrder: 'asc' } },
        _count: { select: { bookings: true, reviews: true } },
      },
    });

    if (!turf) throw new NotFoundException('Turf not found');
    return turf;
  }

  async approveTurf(turfId: string, adminId: string) {
    const turf = await this.prisma.turf.findFirst({
      where: { id: turfId, deletedAt: null },
    });
    if (!turf) throw new NotFoundException('Turf not found');
    if (turf.isApproved) throw new ConflictException('Turf is already approved');

    await this.prisma.turf.update({
      where: { id: turfId },
      data: { isApproved: true, isActive: true, rejectionReason: null },
    });

    this.logger.log(`Admin ${adminId} approved turf ${turfId}`);
    return { message: 'Turf approved successfully' };
  }

  async rejectTurf(turfId: string, reason: string, adminId: string) {
    const turf = await this.prisma.turf.findFirst({
      where: { id: turfId, deletedAt: null },
    });
    if (!turf) throw new NotFoundException('Turf not found');

    await this.prisma.turf.update({
      where: { id: turfId },
      data: { isApproved: false, isActive: false, rejectionReason: reason || null },
    });

    this.logger.log(`Admin ${adminId} rejected turf ${turfId}: ${reason}`);
    return { message: 'Turf rejected' };
  }

  async suspendTurf(turfId: string, reason: string, adminId: string) {
    const turf = await this.prisma.turf.findFirst({
      where: { id: turfId, deletedAt: null },
    });
    if (!turf) throw new NotFoundException('Turf not found');

    await this.prisma.turf.update({
      where: { id: turfId },
      data: { isActive: false },
    });

    this.logger.log(`Admin ${adminId} suspended turf ${turfId}: ${reason}`);
    return { message: 'Turf suspended' };
  }

  // ============================================================================
  // BOOKING MANAGEMENT (READ-ONLY for admin)
  // ============================================================================

  async listBookings(query: BookingAdminQuery) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.BookingWhereInput = { deletedAt: null };

    if (query.status) where.status = query.status;
    if (query.turfId) where.turfId = query.turfId;
    if (query.userId) where.userId = query.userId;

    if (query.startDate || query.endDate) {
      where.bookingDate = {};
      if (query.startDate) (where.bookingDate as Prisma.DateTimeFilter).gte = new Date(query.startDate);
      if (query.endDate) (where.bookingDate as Prisma.DateTimeFilter).lte = new Date(query.endDate);
    }

    if (query.search) {
      const q = query.search.trim();
      where.OR = [
        { bookingNumber: { contains: q, mode: 'insensitive' } },
        { user: { fullName: { contains: q, mode: 'insensitive' } } },
        { user: { email: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: {
          turf: { select: { id: true, name: true } },
          user: { select: { id: true, fullName: true, email: true, phone: true } },
          sport: { select: { id: true, name: true } },
          payments: { select: { id: true, status: true, amount: true, provider: true } },
          refunds: { select: { id: true, status: true, amount: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.booking.count({ where }),
    ]);

    return {
      items: items.map((b) => ({
        id: b.id,
        bookingNumber: b.bookingNumber,
        turfId: b.turfId,
        turfName: b.turf?.name,
        customer: b.user,
        sport: b.sport?.name,
        bookingDate: b.bookingDate,
        startTime: b.startTime,
        endTime: b.endTime,
        status: b.status,
        totalPrice: Number(b.totalPrice),
        basePrice: Number(b.basePrice),
        taxAmount: Number(b.taxAmount),
        discountAmount: Number(b.discountAmount),
        paymentStatus: b.payments[0]?.status ?? null,
        refundStatus: b.refunds[0]?.status ?? null,
        cancelledAt: b.cancelledAt,
        cancellationReason: b.cancellationReason,
        createdAt: b.createdAt,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getBookingById(bookingId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, deletedAt: null },
      include: {
        turf: { select: { id: true, name: true, addressLine: true } },
        user: { select: { id: true, fullName: true, email: true, phone: true } },
        sport: true,
        payments: {
          include: { statusHistory: { orderBy: { createdAt: 'desc' } } },
          orderBy: { createdAt: 'desc' },
        },
        refunds: true,
        statusHistory: { orderBy: { createdAt: 'asc' } },
        checkInAudits: { orderBy: { performedAt: 'desc' } },
        couponUsages: { include: { coupon: { select: { code: true } } } },
      },
    });

    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  // ============================================================================
  // REPORTING APIS
  // ============================================================================

  private buildDateRange(query: ReportQuery): { gte?: Date; lte?: Date } {
    const range: { gte?: Date; lte?: Date } = {};
    if (query.startDate) range.gte = new Date(query.startDate);
    if (query.endDate) range.lte = new Date(query.endDate);
    return range;
  }

  async getRevenueReport(query: ReportQuery) {
    const dateRange = this.buildDateRange(query);

    const where: Prisma.BookingWhereInput = {
      status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
      deletedAt: null,
    };
    if (dateRange.gte || dateRange.lte) where.bookingDate = dateRange;

    const bookings = await this.prisma.booking.findMany({
      where,
      select: {
        bookingDate: true,
        totalPrice: true,
        discountAmount: true,
        taxAmount: true,
        basePrice: true,
        turfId: true,
        turf: { select: { name: true, owner: { select: { businessName: true } } } },
      },
      orderBy: { bookingDate: 'asc' },
    });

    const groupBy = query.groupBy ?? 'day';
    const grouped: Record<string, { revenue: number; count: number; tax: number; discount: number }> = {};

    for (const b of bookings) {
      const key = this.groupKey(b.bookingDate, groupBy);
      if (!grouped[key]) grouped[key] = { revenue: 0, count: 0, tax: 0, discount: 0 };
      grouped[key].revenue += Number(b.totalPrice);
      grouped[key].count += 1;
      grouped[key].tax += Number(b.taxAmount);
      grouped[key].discount += Number(b.discountAmount);
    }

    const trend = Object.entries(grouped)
      .map(([period, val]) => ({
        period,
        revenue: Math.round(val.revenue * 100) / 100,
        bookingsCount: val.count,
        taxAmount: Math.round(val.tax * 100) / 100,
        discountAmount: Math.round(val.discount * 100) / 100,
      }))
      .sort((a, b) => a.period.localeCompare(b.period));

    const totals = {
      revenue: Math.round(bookings.reduce((s, b) => s + Number(b.totalPrice), 0) * 100) / 100,
      bookingsCount: bookings.length,
      taxAmount: Math.round(bookings.reduce((s, b) => s + Number(b.taxAmount), 0) * 100) / 100,
      discountAmount: Math.round(bookings.reduce((s, b) => s + Number(b.discountAmount), 0) * 100) / 100,
    };

    return { totals, trend };
  }

  async getBookingsReport(query: ReportQuery) {
    const dateRange = this.buildDateRange(query);
    const where: Prisma.BookingWhereInput = { deletedAt: null };
    if (dateRange.gte || dateRange.lte) where.bookingDate = dateRange;

    const bookings = await this.prisma.booking.findMany({
      where,
      select: { bookingDate: true, status: true },
      orderBy: { bookingDate: 'asc' },
    });

    const groupBy = query.groupBy ?? 'day';
    const grouped: Record<string, Record<string, number>> = {};

    for (const b of bookings) {
      const key = this.groupKey(b.bookingDate, groupBy);
      if (!grouped[key]) grouped[key] = {};
      grouped[key][b.status] = (grouped[key][b.status] || 0) + 1;
    }

    const statusCounts: Record<string, number> = {};
    for (const b of bookings) {
      statusCounts[b.status] = (statusCounts[b.status] || 0) + 1;
    }

    const trend = Object.entries(grouped)
      .map(([period, statusMap]) => ({ period, ...statusMap }))
      .sort((a, b) => a.period.localeCompare(b.period));

    return {
      total: bookings.length,
      byStatus: statusCounts,
      trend,
    };
  }

  async getUsersReport(query: ReportQuery) {
    const dateRange = this.buildDateRange(query);
    const where: Prisma.UserWhereInput = { deletedAt: null };
    if (dateRange.gte || dateRange.lte) where.createdAt = dateRange;

    const [totalUsers, newUsers, verifiedUsers, roleBreakdown] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where }),
      this.prisma.user.count({ where: { deletedAt: null, isEmailVerified: true } }),
      this.prisma.userRole.groupBy({
        by: ['roleId'],
        _count: true,
      }),
    ]);

    // Enrich role IDs with names
    const roleIds = roleBreakdown.map((r) => r.roleId);
    const roles = await this.prisma.role.findMany({
      where: { id: { in: roleIds } },
      select: { id: true, name: true },
    });
    const roleNameMap = Object.fromEntries(roles.map((r) => [r.id, r.name]));

    return {
      totalUsers,
      newUsersInPeriod: newUsers,
      verifiedUsers,
      verificationRate: totalUsers > 0 ? Math.round((verifiedUsers / totalUsers) * 1000) / 10 : 0,
      byRole: roleBreakdown.map((r) => ({
        role: roleNameMap[r.roleId] ?? r.roleId,
        count: r._count,
      })),
    };
  }

  async getTurfsReport(query: ReportQuery) {
    const dateRange = this.buildDateRange(query);
    const where: Prisma.TurfWhereInput = { deletedAt: null };
    if (dateRange.gte || dateRange.lte) where.createdAt = dateRange;

    const [total, approved, active, byCity] = await Promise.all([
      this.prisma.turf.count({ where: { deletedAt: null } }),
      this.prisma.turf.count({ where: { deletedAt: null, isApproved: true } }),
      this.prisma.turf.count({ where: { deletedAt: null, isActive: true } }),
      this.prisma.turf.groupBy({
        by: ['cityId'],
        where: { deletedAt: null },
        _count: true,
        orderBy: { _count: { cityId: 'desc' } },
        take: 10,
      }),
    ]);

    const cityIds = byCity.map((c) => c.cityId);
    const cities = await this.prisma.city.findMany({
      where: { id: { in: cityIds } },
      select: { id: true, name: true },
    });
    const cityMap = Object.fromEntries(cities.map((c) => [c.id, c.name]));

    return {
      total,
      approved,
      active,
      approvalRate: total > 0 ? Math.round((approved / total) * 1000) / 10 : 0,
      byCity: byCity.map((c) => ({
        cityId: c.cityId,
        cityName: cityMap[c.cityId] ?? 'Unknown',
        turfCount: c._count,
      })),
    };
  }

  async getCommissionReport(query: ReportQuery) {
    const dateRange = this.buildDateRange(query);
    const where: Prisma.CommissionTransactionWhereInput = {};
    if (dateRange.gte || dateRange.lte) where.createdAt = dateRange;

    const [totals, settled, unsettled] = await Promise.all([
      this.prisma.commissionTransaction.aggregate({
        where,
        _sum: { grossAmount: true, commissionAmount: true, netOwnerEarning: true, refundAmount: true },
        _count: true,
      }),
      this.prisma.commissionTransaction.aggregate({
        where: { ...where, isSettled: true },
        _sum: { commissionAmount: true, netOwnerEarning: true },
        _count: true,
      }),
      this.prisma.commissionTransaction.aggregate({
        where: { ...where, isSettled: false },
        _sum: { commissionAmount: true, netOwnerEarning: true },
        _count: true,
      }),
    ]);

    return {
      totals: {
        transactionCount: totals._count,
        grossAmount: Number(totals._sum.grossAmount ?? 0),
        commissionAmount: Number(totals._sum.commissionAmount ?? 0),
        refundAmount: Number(totals._sum.refundAmount ?? 0),
        netOwnerEarning: Number(totals._sum.netOwnerEarning ?? 0),
      },
      settled: {
        count: settled._count,
        commissionAmount: Number(settled._sum.commissionAmount ?? 0),
        netOwnerEarning: Number(settled._sum.netOwnerEarning ?? 0),
      },
      unsettled: {
        count: unsettled._count,
        commissionAmount: Number(unsettled._sum.commissionAmount ?? 0),
        netOwnerEarning: Number(unsettled._sum.netOwnerEarning ?? 0),
      },
    };
  }

  async getRefundsReport(query: ReportQuery) {
    const dateRange = this.buildDateRange(query);
    const where: Prisma.RefundWhereInput = {};
    if (dateRange.gte || dateRange.lte) where.createdAt = dateRange;

    const [totals, byStatus] = await Promise.all([
      this.prisma.refund.aggregate({
        where,
        _sum: { amount: true, cancellationFee: true },
        _count: true,
      }),
      this.prisma.refund.groupBy({
        by: ['status'],
        where,
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return {
      totalCount: totals._count,
      totalAmount: Number(totals._sum.amount ?? 0),
      totalCancellationFees: Number(totals._sum.cancellationFee ?? 0),
      byStatus: byStatus.map((s) => ({
        status: s.status,
        count: s._count,
        amount: Number(s._sum.amount ?? 0),
      })),
    };
  }

  // ============================================================================
  // TURF MANAGEMENT (CREATE / UPDATE / IMAGES — on behalf of owners)
  // ============================================================================

  async createTurf(dto: AdminCreateTurfDto, adminId: string) {
    const owner = await this.prisma.turfOwner.findFirst({
      where: { id: dto.ownerId, deletedAt: null },
    });
    if (!owner) throw new NotFoundException('Owner not found');

    const city = await this.prisma.city.findUnique({
      where: { id: dto.cityId },
    });
    if (!city) throw new BadRequestException('City not found');

    if (dto.areaId) {
      const area = await this.prisma.area.findUnique({
        where: { id: dto.areaId },
      });
      if (!area) throw new BadRequestException('Area not found');
    }

    await this.validateSportAndFacilityIds(dto.sportIds, dto.facilityIds);

    const slug = await this.generateUniqueTurfSlug(dto.name);
    const isApproved = dto.isApproved ?? true;
    const isActive = dto.isActive ?? true;

    const created = await this.prisma.$transaction(async (tx) => {
      const turf = await tx.turf.create({
        data: {
          ownerId: owner.id,
          cityId: dto.cityId,
          areaId: dto.areaId ?? null,
          name: dto.name.trim(),
          slug,
          description: dto.description?.trim() || null,
          addressLine: dto.addressLine.trim(),
          postalCode: dto.postalCode?.trim() || null,
          latitude:
            dto.latitude !== undefined && dto.latitude !== null
              ? new Prisma.Decimal(dto.latitude)
              : null,
          longitude:
            dto.longitude !== undefined && dto.longitude !== null
              ? new Prisma.Decimal(dto.longitude)
              : null,
          contactPhone: dto.contactPhone?.trim() || null,
          contactEmail: dto.contactEmail?.trim() || null,
          coverImageUrl: dto.coverImageUrl?.trim() || null,
          rules: dto.rules?.trim() || null,
          cancellationPolicy: dto.cancellationPolicy?.trim() || null,
          openTime: dto.openTime || '06:00',
          closeTime: dto.closeTime || '22:00',
          slotDurationMinutes: dto.slotDurationMinutes ?? 120,
          advancePaymentAllowed: dto.advancePaymentAllowed ?? true,
          minAdvancePercentage: new Prisma.Decimal(
            dto.minAdvancePercentage ?? 20,
          ),
          minAdvanceAmount: new Prisma.Decimal(dto.minAdvanceAmount ?? 0),
          isActive,
          isApproved,
          isFeatured: dto.isFeatured ?? false,
        },
      });

      if (dto.sportIds?.length) {
        await tx.turfSport.createMany({
          data: dto.sportIds.map((sportId) => ({
            turfId: turf.id,
            sportId,
            isActive: true,
          })),
          skipDuplicates: true,
        });
      }

      if (dto.facilityIds?.length) {
        await tx.turfFacility.createMany({
          data: dto.facilityIds.map((facilityId) => ({
            turfId: turf.id,
            facilityId,
            isActive: true,
          })),
          skipDuplicates: true,
        });
      }

      if (dto.operatingHours?.length) {
        await tx.operatingHour.createMany({
          data: dto.operatingHours.map((h) => ({
            turfId: turf.id,
            dayOfWeek: h.dayOfWeek,
            openTime: h.openTime,
            closeTime: h.closeTime,
            isClosed: h.isClosed ?? false,
            slotDurationMinutes:
              h.slotDurationMinutes ?? dto.slotDurationMinutes ?? 120,
          })),
        });
      } else {
        await tx.operatingHour.createMany({
          data: Array.from({ length: 7 }, (_, dayOfWeek) => ({
            turfId: turf.id,
            dayOfWeek,
            openTime: dto.openTime || '06:00',
            closeTime: dto.closeTime || '22:00',
            isClosed: false,
            slotDurationMinutes: dto.slotDurationMinutes ?? 120,
          })),
        });
      }

      if (dto.pricingRules?.length) {
        await tx.pricingRule.createMany({
          data: dto.pricingRules.map((pr) => ({
            turfId: turf.id,
            sportId: pr.sportId ?? null,
            ruleName: pr.ruleName,
            dayType: pr.dayType || 'ALL',
            dayOfWeek: pr.dayOfWeek ?? null,
            startTime: pr.startTime,
            endTime: pr.endTime,
            hourlyPrice: new Prisma.Decimal(pr.hourlyPrice),
            isActive: true,
          })),
        });
      }

      if (dto.images?.length) {
        await tx.turfImage.createMany({
          data: dto.images.map((img, idx) => ({
            turfId: turf.id,
            imageUrl: img.imageUrl,
            caption: img.caption || null,
            displayOrder: img.displayOrder ?? idx,
            isCover: img.isCover ?? false,
          })),
        });
      }

      return turf;
    });

    this.logger.log(
      `Admin ${adminId} created turf ${created.id} for owner ${owner.id}`,
    );
    return this.getTurfById(created.id);
  }

  async updateTurf(turfId: string, dto: AdminUpdateTurfDto, adminId: string) {
    const turf = await this.prisma.turf.findFirst({
      where: { id: turfId, deletedAt: null },
    });
    if (!turf) throw new NotFoundException('Turf not found');

    if (dto.ownerId) {
      const owner = await this.prisma.turfOwner.findFirst({
        where: { id: dto.ownerId, deletedAt: null },
      });
      if (!owner) throw new NotFoundException('Owner not found');
    }

    if (dto.cityId) {
      const city = await this.prisma.city.findUnique({
        where: { id: dto.cityId },
      });
      if (!city) throw new BadRequestException('City not found');
    }

    if (dto.areaId) {
      const area = await this.prisma.area.findUnique({
        where: { id: dto.areaId },
      });
      if (!area) throw new BadRequestException('Area not found');
    }

    await this.validateSportAndFacilityIds(dto.sportIds, dto.facilityIds);

    const scalar: Prisma.TurfUpdateInput = {};
    const strKeys = [
      'name',
      'description',
      'addressLine',
      'postalCode',
      'contactPhone',
      'contactEmail',
      'coverImageUrl',
      'rules',
      'cancellationPolicy',
      'openTime',
      'closeTime',
    ] as const;
    for (const key of strKeys) {
      const value = dto[key];
      if (value === undefined) continue;
      if (key === 'name' || key === 'addressLine') {
        if (!value.trim()) continue;
        (scalar as Record<string, unknown>)[key] = value.trim();
      } else {
        (scalar as Record<string, unknown>)[key] = value.trim() || null;
      }
    }
    if (dto.ownerId !== undefined)
      scalar.owner = { connect: { id: dto.ownerId } };
    if (dto.cityId !== undefined)
      scalar.city = { connect: { id: dto.cityId } };
    if (dto.areaId !== undefined)
      scalar.area = dto.areaId
        ? { connect: { id: dto.areaId } }
        : { disconnect: true };
    if (dto.latitude !== undefined)
      scalar.latitude =
        dto.latitude !== null ? new Prisma.Decimal(dto.latitude) : null;
    if (dto.longitude !== undefined)
      scalar.longitude =
        dto.longitude !== null ? new Prisma.Decimal(dto.longitude) : null;
    if (dto.slotDurationMinutes !== undefined)
      scalar.slotDurationMinutes = dto.slotDurationMinutes;
    if (dto.advancePaymentAllowed !== undefined)
      scalar.advancePaymentAllowed = dto.advancePaymentAllowed;
    if (dto.minAdvancePercentage !== undefined)
      scalar.minAdvancePercentage = new Prisma.Decimal(
        dto.minAdvancePercentage,
      );
    if (dto.minAdvanceAmount !== undefined)
      scalar.minAdvanceAmount = new Prisma.Decimal(dto.minAdvanceAmount);
    if (dto.isApproved !== undefined) scalar.isApproved = dto.isApproved;
    if (dto.isActive !== undefined) scalar.isActive = dto.isActive;
    if (dto.isFeatured !== undefined) scalar.isFeatured = dto.isFeatured;

    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(scalar).length > 0) {
        await tx.turf.update({ where: { id: turfId }, data: scalar });
      }

      // Replace semantics (same as owner flow) when lists are provided.
      if (dto.sportIds !== undefined) {
        await tx.turfSport.deleteMany({ where: { turfId } });
        if (dto.sportIds.length > 0) {
          await tx.turfSport.createMany({
            data: dto.sportIds.map((sportId) => ({
              turfId,
              sportId,
              isActive: true,
            })),
            skipDuplicates: true,
          });
        }
      }

      if (dto.facilityIds !== undefined) {
        await tx.turfFacility.deleteMany({ where: { turfId } });
        if (dto.facilityIds.length > 0) {
          await tx.turfFacility.createMany({
            data: dto.facilityIds.map((facilityId) => ({
              turfId,
              facilityId,
              isActive: true,
            })),
            skipDuplicates: true,
          });
        }
      }

      if (dto.operatingHours !== undefined) {
        await tx.operatingHour.deleteMany({ where: { turfId } });
        if (dto.operatingHours.length > 0) {
          await tx.operatingHour.createMany({
            data: dto.operatingHours.map((h) => ({
              turfId,
              dayOfWeek: h.dayOfWeek,
              openTime: h.openTime,
              closeTime: h.closeTime,
              isClosed: h.isClosed ?? false,
              slotDurationMinutes:
                h.slotDurationMinutes ?? dto.slotDurationMinutes ?? 120,
            })),
          });
        }
      }

      if (dto.pricingRules !== undefined) {
        await tx.pricingRule.deleteMany({ where: { turfId } });
        if (dto.pricingRules.length > 0) {
          await tx.pricingRule.createMany({
            data: dto.pricingRules.map((pr) => ({
              turfId,
              sportId: pr.sportId ?? null,
              ruleName: pr.ruleName,
              dayType: pr.dayType || 'ALL',
              dayOfWeek: pr.dayOfWeek ?? null,
              startTime: pr.startTime,
              endTime: pr.endTime,
              hourlyPrice: new Prisma.Decimal(pr.hourlyPrice),
              isActive: true,
            })),
          });
        }
      }
    });

    this.logger.log(`Admin ${adminId} updated turf ${turfId}`);
    return this.getTurfById(turfId);
  }

  async addTurfImage(
    turfId: string,
    dto: AdminAddTurfImageDto,
    adminId: string,
  ) {
    const turf = await this.prisma.turf.findFirst({
      where: { id: turfId, deletedAt: null },
    });
    if (!turf) throw new NotFoundException('Turf not found');

    const image = await this.prisma.$transaction(async (tx) => {
      const maxOrder = await tx.turfImage.aggregate({
        where: { turfId },
        _max: { displayOrder: true },
      });

      if (dto.isCover) {
        await tx.turfImage.updateMany({
          where: { turfId },
          data: { isCover: false },
        });
        await tx.turf.update({
          where: { id: turfId },
          data: { coverImageUrl: dto.imageUrl },
        });
      }

      return tx.turfImage.create({
        data: {
          turfId,
          imageUrl: dto.imageUrl,
          caption: dto.caption?.trim() || null,
          displayOrder: (maxOrder._max.displayOrder ?? -1) + 1,
          isCover: dto.isCover ?? false,
        },
      });
    });

    this.logger.log(`Admin ${adminId} added image ${image.id} to turf ${turfId}`);
    return image;
  }

  async uploadTurfImage(
    turfId: string,
    file: { buffer: Buffer; mimetype: string; originalname: string; size: number },
    caption: string | undefined,
    adminId: string,
  ) {
    const turf = await this.prisma.turf.findFirst({
      where: { id: turfId, deletedAt: null },
    });
    if (!turf) throw new NotFoundException('Turf not found');

    const existingCount = await this.prisma.turfImage.count({
      where: { turfId },
    });

    const imageUrl = await this.uploadsService.uploadTurfImage(
      file.buffer,
      file.mimetype,
      file.originalname,
      file.size,
    );

    // First image automatically becomes the cover.
    return this.addTurfImage(
      turfId,
      { imageUrl, caption, isCover: existingCount === 0 },
      adminId,
    );
  }

  async setTurfCoverImage(turfId: string, imageId: string, adminId: string) {
    const image = await this.prisma.turfImage.findFirst({
      where: { id: imageId, turfId },
    });
    if (!image) throw new NotFoundException('Turf image not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.turfImage.updateMany({
        where: { turfId },
        data: { isCover: false },
      });
      await tx.turfImage.update({
        where: { id: imageId },
        data: { isCover: true },
      });
      await tx.turf.update({
        where: { id: turfId },
        data: { coverImageUrl: image.imageUrl },
      });
    });

    this.logger.log(
      `Admin ${adminId} set cover image ${imageId} for turf ${turfId}`,
    );
    return { message: 'Cover image updated successfully' };
  }

  async deleteTurfImage(turfId: string, imageId: string, adminId: string) {
    const image = await this.prisma.turfImage.findFirst({
      where: { id: imageId, turfId },
    });
    if (!image) throw new NotFoundException('Turf image not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.turfImage.delete({ where: { id: imageId } });
      if (image.isCover) {
        await tx.turf.update({
          where: { id: turfId },
          data: { coverImageUrl: null },
        });
      }
    });

    this.logger.log(
      `Admin ${adminId} deleted image ${imageId} from turf ${turfId}`,
    );
    return { message: 'Turf image deleted successfully' };
  }

  // ============================================================================
  // BOOKING CREATION (on behalf of a customer)
  // ============================================================================

  async createBooking(dto: AdminCreateBookingDto, adminId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: dto.userId, deletedAt: null },
    });
    if (!user) throw new NotFoundException('User not found');
    if (!user.isActive)
      throw new BadRequestException('User account is deactivated');

    const turf = await this.prisma.turf.findFirst({
      where: { id: dto.turfId, deletedAt: null },
    });
    if (!turf) throw new NotFoundException('Turf not found');
    if (!turf.isActive) throw new BadRequestException('Turf is inactive');

    if (dto.sportId) {
      const sport = await this.prisma.sport.findFirst({
        where: { id: dto.sportId, isActive: true },
      });
      if (!sport) throw new BadRequestException('Sport not found');
    }

    const startMinutes = this.toMinutes(dto.startTime);
    const endMinutes = this.toMinutes(dto.endTime);
    if (!(endMinutes > startMinutes))
      throw new BadRequestException('endTime must be after startTime');

    // Reuse the live availability engine for closed-day + conflict + pricing.
    const availability = await this.availabilityService.getAvailableSlots(
      dto.turfId,
      { date: dto.bookingDate, sportId: dto.sportId },
    );
    if (availability.isClosed)
      throw new BadRequestException('Turf is closed on the selected date');

    const overlapping = (availability.slots ?? []).filter(
      (s) =>
        this.toMinutes(s.startTime) < endMinutes &&
        this.toMinutes(s.endTime) > startMinutes,
    );
    if (overlapping.length === 0)
      throw new BadRequestException(
        'No bookable slots found in the selected time range',
      );

    const blocked = overlapping.filter((s) => !s.isAvailable);
    if (blocked.length > 0)
      throw new ConflictException(
        `Selected slot is not available (${blocked
          .map((s) => `${s.startTime}-${s.endTime}`)
          .join(', ')})`,
      );

    // Same fee model as the customer flow: 10% platform fee + 18% tax on fee.
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const basePrice = round2(
      overlapping.reduce((sum, s) => sum + Number(s.price ?? 1000), 0),
    );
    const platformFee = round2(basePrice * 0.1);
    const taxAmount = round2(platformFee * 0.18);
    const totalPrice = round2(basePrice + platformFee + taxAmount);
    const durationMinutes = overlapping.reduce(
      (sum, s) => sum + (s.durationMinutes ?? 60),
      0,
    );

    const bookingNumber = generateBookingNumber({
      prefix: 'ADM',
      turfName: turf.name,
      bookingDate: dto.bookingDate,
    });

    const booking = await this.prisma.$transaction(async (tx) => {
      const created = await tx.booking.create({
        data: {
          bookingNumber,
          userId: user.id,
          turfId: turf.id,
          sportId: dto.sportId ?? null,
          bookingDate: new Date(dto.bookingDate),
          startTime: dto.startTime,
          endTime: dto.endTime,
          durationMinutes,
          timeSlots: overlapping.map((s) => ({
            startTime: s.startTime,
            endTime: s.endTime,
            price: Number(s.price ?? 1000),
          })),
          status: BookingStatus.CONFIRMED,
          basePrice: new Prisma.Decimal(basePrice),
          taxAmount: new Prisma.Decimal(taxAmount),
          discountAmount: new Prisma.Decimal(0),
          totalPrice: new Prisma.Decimal(totalPrice),
          isAdvanceBooking: false,
          advanceAmount: new Prisma.Decimal(0),
          paidAmount: new Prisma.Decimal(totalPrice),
          remainingAmount: new Prisma.Decimal(0),
          paymentStatus: 'PAID',
        },
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: created.id,
          fromStatus: null,
          toStatus: BookingStatus.CONFIRMED,
          reason: 'Booking created by admin on behalf of customer',
          changedByUserId: adminId,
        },
      });

      return created;
    });

    this.logger.log(
      `Admin ${adminId} created booking ${booking.id} for user ${user.id}`,
    );
    return this.getBookingById(booking.id);
  }

  // ============================================================================
  // CATALOG MANAGEMENT (sports + facilities)
  // ============================================================================

  async listSports() {
    const items = await this.prisma.sport.findMany({
      where: { deletedAt: null },
      include: { _count: { select: { turfSports: true } } },
      orderBy: { name: 'asc' },
    });
    return { items };
  }

  async createSport(dto: AdminCreateSportDto, adminId: string) {
    const name = dto.name.trim();
    const existing = await this.prisma.sport.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    });
    if (existing) throw new ConflictException('Sport name already exists');

    const slug = dto.slug?.trim() || this.slugify(name);
    const slugTaken = await this.prisma.sport.findUnique({ where: { slug } });
    if (slugTaken) throw new ConflictException('Sport slug already exists');

    const minPlayers = dto.minPlayers ?? 2;
    const maxPlayers = dto.maxPlayers ?? 22;
    if (minPlayers > maxPlayers)
      throw new BadRequestException('minPlayers cannot exceed maxPlayers');

    const sport = await this.prisma.sport.create({
      data: {
        name,
        slug,
        description: dto.description?.trim() || null,
        iconUrl: dto.iconUrl?.trim() || null,
        minPlayers,
        maxPlayers,
        isActive: dto.isActive ?? true,
      },
    });

    this.logger.log(`Admin ${adminId} created sport ${sport.id}`);
    return sport;
  }

  async updateSport(sportId: string, dto: AdminUpdateSportDto, adminId: string) {
    const sport = await this.prisma.sport.findFirst({
      where: { id: sportId, deletedAt: null },
    });
    if (!sport) throw new NotFoundException('Sport not found');

    const data: Prisma.SportUpdateInput = {};

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new BadRequestException('Sport name cannot be empty');
      const clash = await this.prisma.sport.findFirst({
        where: {
          name: { equals: name, mode: 'insensitive' },
          id: { not: sportId },
        },
      });
      if (clash) throw new ConflictException('Sport name already exists');
      data.name = name;
      // Keep slug in sync when it wasn't explicitly provided.
      if (dto.slug === undefined) {
        const slug = this.slugify(name);
        const slugClash = await this.prisma.sport.findFirst({
          where: { slug, id: { not: sportId } },
        });
        if (slugClash)
          throw new ConflictException(
            'Generated slug already exists — provide slug explicitly',
          );
        data.slug = slug;
      }
    }

    if (dto.slug !== undefined) {
      const slug = dto.slug.trim();
      const slugClash = await this.prisma.sport.findFirst({
        where: { slug, id: { not: sportId } },
      });
      if (slugClash) throw new ConflictException('Sport slug already exists');
      data.slug = slug;
    }

    if (dto.description !== undefined)
      data.description = dto.description?.trim() || null;
    if (dto.iconUrl !== undefined)
      data.iconUrl = dto.iconUrl?.trim() || null;
    if (dto.minPlayers !== undefined) data.minPlayers = dto.minPlayers;
    if (dto.maxPlayers !== undefined) data.maxPlayers = dto.maxPlayers;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const minPlayers = (data.minPlayers ?? sport.minPlayers) as number;
    const maxPlayers = (data.maxPlayers ?? sport.maxPlayers) as number;
    if (minPlayers > maxPlayers)
      throw new BadRequestException('minPlayers cannot exceed maxPlayers');

    const updated = await this.prisma.sport.update({
      where: { id: sportId },
      data,
    });

    this.logger.log(`Admin ${adminId} updated sport ${sportId}`);
    return updated;
  }

  async deleteSport(sportId: string, adminId: string) {
    const sport = await this.prisma.sport.findFirst({
      where: { id: sportId, deletedAt: null },
    });
    if (!sport) throw new NotFoundException('Sport not found');

    // Soft delete: history (bookings, pricing rules) stays intact.
    await this.prisma.sport.update({
      where: { id: sportId },
      data: { isActive: false, deletedAt: new Date() },
    });

    this.logger.log(`Admin ${adminId} deleted sport ${sportId}`);
    return { message: 'Sport deleted successfully' };
  }

  async listFacilities() {
    const items = await this.prisma.facility.findMany({
      include: { _count: { select: { turfFacilities: true } } },
      orderBy: { name: 'asc' },
    });
    return { items };
  }

  async createFacility(dto: AdminCreateFacilityDto, adminId: string) {
    const name = dto.name.trim();
    const existing = await this.prisma.facility.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    });
    if (existing) throw new ConflictException('Facility name already exists');

    const slug = dto.slug?.trim() || this.slugify(name);
    const slugTaken = await this.prisma.facility.findUnique({ where: { slug } });
    if (slugTaken)
      throw new ConflictException('Facility slug already exists');

    const facility = await this.prisma.facility.create({
      data: {
        name,
        slug,
        description: dto.description?.trim() || null,
        iconUrl: dto.iconUrl?.trim() || null,
        isActive: dto.isActive ?? true,
      },
    });

    this.logger.log(`Admin ${adminId} created facility ${facility.id}`);
    return facility;
  }

  async updateFacility(
    facilityId: string,
    dto: AdminUpdateFacilityDto,
    adminId: string,
  ) {
    const facility = await this.prisma.facility.findUnique({
      where: { id: facilityId },
    });
    if (!facility) throw new NotFoundException('Facility not found');

    const data: Prisma.FacilityUpdateInput = {};

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new BadRequestException('Facility name cannot be empty');
      const clash = await this.prisma.facility.findFirst({
        where: {
          name: { equals: name, mode: 'insensitive' },
          id: { not: facilityId },
        },
      });
      if (clash) throw new ConflictException('Facility name already exists');
      data.name = name;
      if (dto.slug === undefined) {
        const slug = this.slugify(name);
        const slugClash = await this.prisma.facility.findFirst({
          where: { slug, id: { not: facilityId } },
        });
        if (slugClash)
          throw new ConflictException(
            'Generated slug already exists — provide slug explicitly',
          );
        data.slug = slug;
      }
    }

    if (dto.slug !== undefined) {
      const slug = dto.slug.trim();
      const slugClash = await this.prisma.facility.findFirst({
        where: { slug, id: { not: facilityId } },
      });
      if (slugClash)
        throw new ConflictException('Facility slug already exists');
      data.slug = slug;
    }

    if (dto.description !== undefined)
      data.description = dto.description?.trim() || null;
    if (dto.iconUrl !== undefined)
      data.iconUrl = dto.iconUrl?.trim() || null;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const updated = await this.prisma.facility.update({
      where: { id: facilityId },
      data,
    });

    this.logger.log(`Admin ${adminId} updated facility ${facilityId}`);
    return updated;
  }

  async deleteFacility(facilityId: string, adminId: string) {
    const facility = await this.prisma.facility.findUnique({
      where: { id: facilityId },
    });
    if (!facility) throw new NotFoundException('Facility not found');

    const inUse = await this.prisma.turfFacility.count({
      where: { facilityId },
    });
    if (inUse > 0)
      throw new ConflictException(
        `Facility is used by ${inUse} turf(s) — deactivate it instead of deleting`,
      );

    await this.prisma.facility.delete({ where: { id: facilityId } });

    this.logger.log(`Admin ${adminId} deleted facility ${facilityId}`);
    return { message: 'Facility deleted successfully' };
  }

  // ============================================================================
  // REVIEW MODERATION
  // ============================================================================

  async listReviews(query: {
    search?: string;
    turfId?: string;
    rating?: number;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.ReviewWhereInput = {};
    if (query.turfId) where.turfId = query.turfId;
    if (query.rating !== undefined) where.rating = query.rating;
    if (query.search?.trim()) {
      const q = query.search.trim();
      where.OR = [
        { comment: { contains: q, mode: 'insensitive' } },
        { user: { fullName: { contains: q, mode: 'insensitive' } } },
        { user: { email: { contains: q, mode: 'insensitive' } } },
        { turf: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        include: {
          user: { select: { id: true, fullName: true, email: true } },
          turf: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async deleteReview(reviewId: string, adminId: string) {
    return this.reviewsService.deleteReview(reviewId, adminId, [
      Role.SUPER_ADMIN,
    ]);
  }

  // ============================================================================
  // REFUND MANAGEMENT
  // ============================================================================

  async listRefunds(query: {
    search?: string;
    status?: RefundStatus;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.RefundWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.search?.trim()) {
      const q = query.search.trim();
      where.OR = [
        { refundNumber: { contains: q, mode: 'insensitive' } },
        { booking: { bookingNumber: { contains: q, mode: 'insensitive' } } },
        { user: { email: { contains: q, mode: 'insensitive' } } },
        { user: { fullName: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.refund.findMany({
        where,
        include: {
          booking: {
            select: {
              id: true,
              bookingNumber: true,
              turf: { select: { id: true, name: true } },
            },
          },
          user: {
            select: { id: true, fullName: true, email: true, phone: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.refund.count({ where }),
    ]);

    return {
      items: items.map((r) => ({
        ...r,
        amount: Number(r.amount),
        cancellationFee: Number(r.cancellationFee),
        refundPercentage:
          r.refundPercentage != null ? Number(r.refundPercentage) : null,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async processRefund(
    refundId: string,
    dto: { status: RefundStatus; failureReason?: string; gatewayRefundId?: string },
    adminId: string,
  ) {
    const refund = await this.prisma.refund.findUnique({
      where: { id: refundId },
    });
    if (!refund) throw new NotFoundException('Refund not found');
    if (refund.status !== RefundStatus.PENDING)
      throw new BadRequestException(
        `Refund is already ${refund.status.toLowerCase()}`,
      );

    if (dto.status === RefundStatus.FAILED && !dto.failureReason?.trim()) {
      throw new BadRequestException(
        'A failure reason is required to mark a refund as failed',
      );
    }

    const updated = await this.prisma.refund.update({
      where: { id: refundId },
      data: {
        status: dto.status,
        failureReason:
          dto.status === RefundStatus.FAILED ? dto.failureReason!.trim() : null,
        gatewayRefundId: dto.gatewayRefundId?.trim() || refund.gatewayRefundId,
        processedAt: new Date(),
      },
    });

    this.logger.log(
      `Admin ${adminId} marked refund ${refundId} as ${dto.status}`,
    );
    return { ...updated, amount: Number(updated.amount) };
  }

  // ============================================================================
  // LOCATION MANAGEMENT (country > state > city > area)
  // ============================================================================

  async listCountries() {
    const items = await this.prisma.country.findMany({
      include: { _count: { select: { states: true } } },
      orderBy: { name: 'asc' },
    });
    return { items };
  }

  async createCountry(dto: AdminCreateCountryDto, adminId: string) {
    const name = dto.name.trim();
    const code = dto.code.trim().toUpperCase();
    const clash = await this.prisma.country.findFirst({
      where: { OR: [{ name: { equals: name, mode: 'insensitive' } }, { code }] },
    });
    if (clash) throw new ConflictException('Country name or code already exists');

    const country = await this.prisma.country.create({
      data: {
        name,
        code,
        phoneCode: dto.phoneCode.trim(),
        currency: dto.currency?.trim() || 'INR',
        isActive: dto.isActive ?? true,
      },
    });
    this.logger.log(`Admin ${adminId} created country ${country.id}`);
    return country;
  }

  async updateCountry(countryId: string, dto: AdminUpdateCountryDto, adminId: string) {
    const country = await this.prisma.country.findUnique({ where: { id: countryId } });
    if (!country) throw new NotFoundException('Country not found');

    const data: Prisma.CountryUpdateInput = {};
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new BadRequestException('Country name cannot be empty');
      const clash = await this.prisma.country.findFirst({
        where: { name: { equals: name, mode: 'insensitive' }, id: { not: countryId } },
      });
      if (clash) throw new ConflictException('Country name already exists');
      data.name = name;
    }
    if (dto.code !== undefined) {
      const code = dto.code.trim().toUpperCase();
      const clash = await this.prisma.country.findFirst({
        where: { code, id: { not: countryId } },
      });
      if (clash) throw new ConflictException('Country code already exists');
      data.code = code;
    }
    if (dto.phoneCode !== undefined) data.phoneCode = dto.phoneCode.trim();
    if (dto.currency !== undefined) data.currency = dto.currency.trim() || 'INR';
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const updated = await this.prisma.country.update({ where: { id: countryId }, data });
    this.logger.log(`Admin ${adminId} updated country ${countryId}`);
    return updated;
  }

  async deleteCountry(countryId: string, adminId: string) {
    const used = await this.prisma.state.count({ where: { countryId } });
    if (used > 0)
      throw new ConflictException(`Country has ${used} state(s) — deactivate instead`);
    const existing = await this.prisma.country.findUnique({ where: { id: countryId } });
    if (!existing) throw new NotFoundException('Country not found');
    await this.prisma.country.delete({ where: { id: countryId } });
    this.logger.log(`Admin ${adminId} deleted country ${countryId}`);
    return { message: 'Country deleted successfully' };
  }

  async listStates(countryId?: string) {
    const items = await this.prisma.state.findMany({
      where: countryId ? { countryId } : {},
      include: {
        country: { select: { id: true, name: true } },
        _count: { select: { cities: true } },
      },
      orderBy: { name: 'asc' },
    });
    return { items };
  }

  async createState(dto: AdminCreateStateDto, adminId: string) {
    const country = await this.prisma.country.findUnique({ where: { id: dto.countryId } });
    if (!country) throw new NotFoundException('Country not found');

    const name = dto.name.trim();
    const code = dto.code.trim().toUpperCase();
    const clash = await this.prisma.state.findFirst({
      where: {
        OR: [
          { countryId: dto.countryId, code },
          { countryId: dto.countryId, name: { equals: name, mode: 'insensitive' } },
        ],
      },
    });
    if (clash) throw new ConflictException('State name or code already exists in this country');

    const state = await this.prisma.state.create({
      data: { countryId: dto.countryId, name, code, isActive: dto.isActive ?? true },
    });
    this.logger.log(`Admin ${adminId} created state ${state.id}`);
    return state;
  }

  async updateState(stateId: string, dto: AdminUpdateStateDto, adminId: string) {
    const state = await this.prisma.state.findUnique({ where: { id: stateId } });
    if (!state) throw new NotFoundException('State not found');

    const countryId = dto.countryId ?? state.countryId;
    if (dto.countryId) {
      const country = await this.prisma.country.findUnique({ where: { id: dto.countryId } });
      if (!country) throw new NotFoundException('Country not found');
    }

    const data: Prisma.StateUpdateInput = {};
    const name = dto.name !== undefined ? dto.name.trim() : state.name;
    const code = dto.code !== undefined ? dto.code.trim().toUpperCase() : state.code;
    if (dto.name !== undefined && !name) throw new BadRequestException('State name cannot be empty');
    if (dto.name !== undefined || dto.code !== undefined || dto.countryId) {
      const clash = await this.prisma.state.findFirst({
        where: {
          countryId,
          OR: [{ name: { equals: name, mode: 'insensitive' } }, { code }],
          id: { not: stateId },
        },
      });
      if (clash) throw new ConflictException('State name or code already exists in this country');
      if (dto.name !== undefined) data.name = name;
      if (dto.code !== undefined) data.code = code;
    }
    if (dto.countryId) data.country = { connect: { id: dto.countryId } };
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const updated = await this.prisma.state.update({ where: { id: stateId }, data });
    this.logger.log(`Admin ${adminId} updated state ${stateId}`);
    return updated;
  }

  async deleteState(stateId: string, adminId: string) {
    const existing = await this.prisma.state.findUnique({ where: { id: stateId } });
    if (!existing) throw new NotFoundException('State not found');
    const used = await this.prisma.city.count({ where: { stateId } });
    if (used > 0)
      throw new ConflictException(`State has ${used} citie(s) — deactivate instead`);
    await this.prisma.state.delete({ where: { id: stateId } });
    this.logger.log(`Admin ${adminId} deleted state ${stateId}`);
    return { message: 'State deleted successfully' };
  }

  async listCities(stateId?: string) {
    const items = await this.prisma.city.findMany({
      where: stateId ? { stateId } : {},
      include: {
        state: { select: { id: true, name: true, country: { select: { id: true, name: true } } } },
        _count: { select: { areas: true, turfs: true } },
      },
      orderBy: { name: 'asc' },
    });
    return { items };
  }

  async createCity(dto: AdminCreateCityDto, adminId: string) {
    const state = await this.prisma.state.findUnique({ where: { id: dto.stateId } });
    if (!state) throw new NotFoundException('State not found');

    const name = dto.name.trim();
    const slug = dto.slug?.trim() || this.slugify(name);
    const slugTaken = await this.prisma.city.findUnique({ where: { slug } });
    if (slugTaken) throw new ConflictException('City slug already exists');

    const city = await this.prisma.city.create({
      data: {
        stateId: dto.stateId,
        name,
        slug,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
        isActive: dto.isActive ?? true,
      },
    });
    this.logger.log(`Admin ${adminId} created city ${city.id}`);
    return city;
  }

  async updateCity(cityId: string, dto: AdminUpdateCityDto, adminId: string) {
    const city = await this.prisma.city.findUnique({ where: { id: cityId } });
    if (!city) throw new NotFoundException('City not found');

    if (dto.stateId) {
      const state = await this.prisma.state.findUnique({ where: { id: dto.stateId } });
      if (!state) throw new NotFoundException('State not found');
    }

    const data: Prisma.CityUpdateInput = {};
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new BadRequestException('City name cannot be empty');
      data.name = name;
      if (dto.slug === undefined) {
        const slug = this.slugify(name);
        const clash = await this.prisma.city.findFirst({ where: { slug, id: { not: cityId } } });
        if (clash) throw new ConflictException('Generated slug taken — provide slug explicitly');
        data.slug = slug;
      }
    }
    if (dto.slug !== undefined) {
      const slug = dto.slug.trim();
      const clash = await this.prisma.city.findFirst({ where: { slug, id: { not: cityId } } });
      if (clash) throw new ConflictException('City slug already exists');
      data.slug = slug;
    }
    if (dto.stateId) data.state = { connect: { id: dto.stateId } };
    if (dto.latitude !== undefined) data.latitude = dto.latitude;
    if (dto.longitude !== undefined) data.longitude = dto.longitude;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const updated = await this.prisma.city.update({ where: { id: cityId }, data });
    this.logger.log(`Admin ${adminId} updated city ${cityId}`);
    return updated;
  }

  async deleteCity(cityId: string, adminId: string) {
    const existing = await this.prisma.city.findUnique({ where: { id: cityId } });
    if (!existing) throw new NotFoundException('City not found');
    const [areas, turfs] = await Promise.all([
      this.prisma.area.count({ where: { cityId } }),
      this.prisma.turf.count({ where: { cityId, deletedAt: null } }),
    ]);
    if (areas + turfs > 0)
      throw new ConflictException(
        `City is used by ${areas} area(s) and ${turfs} turf(s) — deactivate instead`,
      );
    await this.prisma.city.delete({ where: { id: cityId } });
    this.logger.log(`Admin ${adminId} deleted city ${cityId}`);
    return { message: 'City deleted successfully' };
  }

  async listAreas(cityId?: string) {
    const items = await this.prisma.area.findMany({
      where: cityId ? { cityId } : {},
      include: {
        city: { select: { id: true, name: true } },
        _count: { select: { turfs: true } },
      },
      orderBy: { name: 'asc' },
    });
    return { items };
  }

  async createArea(dto: AdminCreateAreaDto, adminId: string) {
    const city = await this.prisma.city.findUnique({ where: { id: dto.cityId } });
    if (!city) throw new NotFoundException('City not found');

    const name = dto.name.trim();
    const slug = dto.slug?.trim() || this.slugify(name);
    const slugTaken = await this.prisma.area.findFirst({
      where: { cityId: dto.cityId, slug },
    });
    if (slugTaken) throw new ConflictException('Area slug already exists in this city');

    const area = await this.prisma.area.create({
      data: {
        cityId: dto.cityId,
        name,
        slug,
        postalCode: dto.postalCode?.trim() || null,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
        isActive: dto.isActive ?? true,
      },
    });
    this.logger.log(`Admin ${adminId} created area ${area.id}`);
    return area;
  }

  async updateArea(areaId: string, dto: AdminUpdateAreaDto, adminId: string) {
    const area = await this.prisma.area.findUnique({ where: { id: areaId } });
    if (!area) throw new NotFoundException('Area not found');

    const cityId = dto.cityId ?? area.cityId;
    if (dto.cityId) {
      const city = await this.prisma.city.findUnique({ where: { id: dto.cityId } });
      if (!city) throw new NotFoundException('City not found');
    }

    const data: Prisma.AreaUpdateInput = {};
    const name = dto.name !== undefined ? dto.name.trim() : area.name;
    if (dto.name !== undefined && !name) throw new BadRequestException('Area name cannot be empty');
    if (dto.name !== undefined) data.name = name;
    const wantSlug = dto.slug !== undefined ? dto.slug.trim() : dto.name !== undefined || dto.cityId ? this.slugify(name) : undefined;
    if (wantSlug) {
      const clash = await this.prisma.area.findFirst({
        where: { cityId, slug: wantSlug, id: { not: areaId } },
      });
      if (clash) throw new ConflictException('Area slug already exists in this city');
      data.slug = wantSlug;
    }
    if (dto.cityId) data.city = { connect: { id: dto.cityId } };
    if (dto.postalCode !== undefined) data.postalCode = dto.postalCode?.trim() || null;
    if (dto.latitude !== undefined) data.latitude = dto.latitude;
    if (dto.longitude !== undefined) data.longitude = dto.longitude;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const updated = await this.prisma.area.update({ where: { id: areaId }, data });
    this.logger.log(`Admin ${adminId} updated area ${areaId}`);
    return updated;
  }

  async deleteArea(areaId: string, adminId: string) {
    const existing = await this.prisma.area.findUnique({ where: { id: areaId } });
    if (!existing) throw new NotFoundException('Area not found');
    const used = await this.prisma.turf.count({ where: { areaId, deletedAt: null } });
    if (used > 0)
      throw new ConflictException(`Area is used by ${used} turf(s) — deactivate instead`);
    await this.prisma.area.delete({ where: { id: areaId } });
    this.logger.log(`Admin ${adminId} deleted area ${areaId}`);
    return { message: 'Area deleted successfully' };
  }

  // ============================================================================
  // AVAILABILITY, BLOCKS, PRICING (delegated, admin identity)
  // ============================================================================

  private async assertAdminTurf(turfId: string) {
    const turf = await this.prisma.turf.findFirst({
      where: { id: turfId, deletedAt: null },
      select: { id: true },
    });
    if (!turf) throw new NotFoundException('Turf not found');
  }

  async getTurfAvailability(turfId: string, adminId: string) {
    await this.assertAdminTurf(turfId);
    return this.availabilityService.getOwnerAvailability(
      adminId,
      [Role.SUPER_ADMIN],
      turfId,
    );
  }

  async setTurfAvailability(
    turfId: string,
    dto: SetAvailabilityDto,
    adminId: string,
  ) {
    await this.assertAdminTurf(turfId);
    return this.availabilityService.setOwnerAvailability(
      adminId,
      [Role.SUPER_ADMIN],
      turfId,
      dto,
    );
  }

  async updateTurfAvailability(
    turfId: string,
    dto: SetAvailabilityDto,
    adminId: string,
  ) {
    await this.assertAdminTurf(turfId);
    return this.availabilityService.updateOwnerAvailability(
      adminId,
      [Role.SUPER_ADMIN],
      turfId,
      dto,
    );
  }

  async blockTurfSlot(turfId: string, dto: BlockSlotDto, adminId: string) {
    await this.assertAdminTurf(turfId);
    const res = await this.availabilityService.blockSlot(
      adminId,
      [Role.SUPER_ADMIN],
      turfId,
      dto,
    );
    this.logger.log(`Admin ${adminId} blocked slot on turf ${turfId}`);
    return res;
  }

  async unblockTurfSlot(turfId: string, slotId: string, adminId: string) {
    await this.assertAdminTurf(turfId);
    const res = await this.availabilityService.unblockSlot(
      adminId,
      [Role.SUPER_ADMIN],
      turfId,
      slotId,
    );
    this.logger.log(`Admin ${adminId} unblocked slot ${slotId} on turf ${turfId}`);
    return res;
  }

  // ============================================================================
  // TURF VIDEOS (URL-based gallery)
  // ============================================================================

  async addTurfVideo(
    turfId: string,
    dto: { videoUrl: string; thumbnailUrl?: string; title?: string },
    adminId: string,
  ) {
    await this.assertAdminTurf(turfId);
    const maxOrder = await this.prisma.turfVideo.aggregate({
      where: { turfId },
      _max: { displayOrder: true },
    });
    const video = await this.prisma.turfVideo.create({
      data: {
        turfId,
        videoUrl: dto.videoUrl,
        thumbnailUrl: dto.thumbnailUrl || null,
        title: dto.title?.trim() || null,
        displayOrder: (maxOrder._max.displayOrder ?? -1) + 1,
      },
    });
    this.logger.log(`Admin ${adminId} added video ${video.id} to turf ${turfId}`);
    return video;
  }

  async uploadTurfVideo(
    turfId: string,
    file: { buffer: Buffer; mimetype: string; originalname: string; size: number },
    title: string | undefined,
    adminId: string,
  ) {
    await this.assertAdminTurf(turfId);

    const videoUrl = await this.uploadsService.uploadTurfVideo(
      file.buffer,
      file.mimetype,
      file.originalname,
      file.size,
    );

    return this.addTurfVideo(turfId, { videoUrl, title }, adminId);
  }

  async deleteTurfVideo(turfId: string, videoId: string, adminId: string) {
    await this.assertAdminTurf(turfId);
    const video = await this.prisma.turfVideo.findFirst({
      where: { id: videoId, turfId },
    });
    if (!video) throw new NotFoundException('Turf video not found');
    await this.prisma.turfVideo.delete({ where: { id: videoId } });
    this.logger.log(`Admin ${adminId} deleted video ${videoId} from turf ${turfId}`);
    return { message: 'Turf video deleted successfully' };
  }

  // ============================================================================
  // NOTIFICATION BROADCAST
  // ============================================================================

  async broadcastNotification(
    dto: { title: string; body: string; role?: string; userIds?: string[] },
    adminId: string,
  ) {
    const title = dto.title.trim();
    const body = dto.body.trim();
    if (!title || !body)
      throw new BadRequestException('Title and body are required');

    let recipientIds: string[];
    if (dto.userIds?.length) {
      const users = await this.prisma.user.findMany({
        where: {
          id: { in: [...new Set(dto.userIds)] },
          isActive: true,
          deletedAt: null,
        },
        select: { id: true },
      });
      recipientIds = users.map((u) => u.id);
    } else {
      const where: Prisma.UserWhereInput = { isActive: true, deletedAt: null };
      if (dto.role) {
        if (!Object.values(Role).includes(dto.role as Role))
          throw new BadRequestException(`Unknown role: ${dto.role}`);
        where.roles = { some: { role: { name: dto.role } } };
      }
      const users = await this.prisma.user.findMany({
        where,
        select: { id: true },
      });
      recipientIds = users.map((u) => u.id);
    }

    if (recipientIds.length === 0)
      throw new BadRequestException('No active recipients found');

    await this.prisma.notification.createMany({
      data: recipientIds.map((userId) => ({
        userId,
        type: 'SYSTEM',
        title,
        body,
        data: { broadcastBy: adminId },
      })),
    });

    this.logger.log(
      `Admin ${adminId} broadcast notification to ${recipientIds.length} users`,
    );
    return {
      message: 'Broadcast sent',
      recipientCount: recipientIds.length,
    };
  }

  // ============================================================================
  // STAFF ASSIGNMENTS (manager/staff turf scope)
  // ============================================================================

  async listStaffAssignments(ownerId?: string) {
    const items = await this.prisma.staffAssignment.findMany({
      where: ownerId ? { turfOwnerId: ownerId } : {},
      include: {
        user: { select: { id: true, fullName: true, email: true, isActive: true } },
        owner: { select: { id: true, businessName: true } },
        turf: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return { items };
  }

  async assignStaff(
    dto: { userId: string; turfOwnerId: string; turfId?: string },
    adminId: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: dto.userId, deletedAt: null },
      include: { roles: { include: { role: true } } },
    });
    if (!user) throw new NotFoundException('User not found');
    const roles = user.roles.map((r) => r.role.name);
    if (
      !roles.includes(Role.MANAGER) &&
      !roles.includes(Role.STAFF) &&
      !roles.includes(Role.TURF_OWNER)
    ) {
      throw new BadRequestException(
        'User must have MANAGER, STAFF or TURF_OWNER role to be assigned',
      );
    }

    const owner = await this.prisma.turfOwner.findFirst({
      where: { id: dto.turfOwnerId, deletedAt: null },
    });
    if (!owner) throw new NotFoundException('Owner not found');

    if (dto.turfId) {
      const turf = await this.prisma.turf.findFirst({
        where: { id: dto.turfId, deletedAt: null },
      });
      if (!turf) throw new NotFoundException('Turf not found');
      if (turf.ownerId !== dto.turfOwnerId)
        throw new BadRequestException('Turf does not belong to this owner');
    }

    const assignment = await this.prisma.staffAssignment.upsert({
      where: { userId: dto.userId },
      create: {
        userId: dto.userId,
        turfOwnerId: dto.turfOwnerId,
        turfId: dto.turfId ?? null,
        isActive: true,
      },
      update: {
        turfOwnerId: dto.turfOwnerId,
        turfId: dto.turfId ?? null,
        isActive: true,
      },
    });

    this.logger.log(
      `Admin ${adminId} assigned user ${dto.userId} to owner ${dto.turfOwnerId}`,
    );
    return assignment;
  }

  async revokeStaff(assignmentId: string, adminId: string) {
    const existing = await this.prisma.staffAssignment.findUnique({
      where: { id: assignmentId },
    });
    if (!existing) throw new NotFoundException('Staff assignment not found');
    await this.prisma.staffAssignment.delete({ where: { id: assignmentId } });
    this.logger.log(
      `Admin ${adminId} revoked staff assignment ${assignmentId}`,
    );
    return { message: 'Staff assignment revoked' };
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private async validateSportAndFacilityIds(
    sportIds?: string[],
    facilityIds?: string[],
  ) {
    if (sportIds?.length) {
      const count = await this.prisma.sport.count({
        where: { id: { in: sportIds }, isActive: true },
      });
      if (count !== new Set(sportIds).size)
        throw new BadRequestException('One or more sports are invalid');
    }
    if (facilityIds?.length) {
      const count = await this.prisma.facility.count({
        where: { id: { in: facilityIds }, isActive: true },
      });
      if (count !== new Set(facilityIds).size)
        throw new BadRequestException('One or more facilities are invalid');
    }
  }

  private async generateUniqueTurfSlug(name: string): Promise<string> {
    const base =
      name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'turf';
    let slug = base;
    let counter = 1;
    while (await this.prisma.turf.findUnique({ where: { slug } })) {
      slug = `${base}-${counter}`;
      counter++;
    }
    return slug;
  }

  private toMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  private slugify(name: string): string {
    return (
      name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'item'
    );
  }

  private groupKey(date: Date, groupBy: 'day' | 'week' | 'month'): string {
    const d = new Date(date);
    if (groupBy === 'month') return d.toISOString().substring(0, 7);
    if (groupBy === 'week') {
      // ISO week start (Monday)
      const day = d.getDay() || 7;
      d.setDate(d.getDate() + 1 - day);
      return d.toISOString().split('T')[0];
    }
    return d.toISOString().split('T')[0];
  }
}
