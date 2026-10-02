import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { Role } from '../common/enums/role.enum';
import { TurfQueryDto } from './dto/turf-query.dto';
import { TurfNearbyDto } from './dto/turf-nearby.dto';
import { CreateTurfDto, TurfImageInputDto } from './dto/create-turf.dto';
import { UpdateTurfDto } from './dto/update-turf.dto';
import { UpdateTurfStatusDto } from './dto/update-turf-status.dto';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { UploadsService } from '../uploads/uploads.service';
import { resolveManagedScope } from '../owners/staff-scope';

@Injectable()
export class TurfsService {
  private readonly logger = new Logger(TurfsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadsService: UploadsService,
  ) {}

  // ---------------------------------------------------------------------------
  // HELPER: Haversine Great-Circle Distance (in Kilometers)
  // ---------------------------------------------------------------------------
  private calculateDistanceKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 100) / 100;
  }

  // ---------------------------------------------------------------------------
  // HELPER: Generate URL-safe unique slug
  // ---------------------------------------------------------------------------
  private async generateUniqueSlug(name: string): Promise<string> {
    const baseSlug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    let slug = baseSlug;
    let counter = 1;

    while (await this.prisma.turf.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  // ---------------------------------------------------------------------------
  // HELPER: Resolve or create TurfOwner profile
  // ---------------------------------------------------------------------------
  private async getOrCreateOwnerProfile(userId: string) {
    let owner = await this.prisma.turfOwner.findUnique({
      where: { userId },
    });

    if (!owner) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException('Owner account not found');
      }

      // Auto-provisioned profiles also default to UNVERIFIED and INACTIVE
      // until explicitly approved by an admin.
      owner = await this.prisma.turfOwner.create({
        data: {
          userId,
          businessName: `${user.fullName}'s Sports Group`,
          isActive: false,
          isVerified: false,
        },
      });
    }

    return owner;
  }

  // ===========================================================================
  // CUSTOMER APIS
  // ===========================================================================

  // 1. GET /api/v1/turfs (Paginated, Filtered, Sorted)
  async findAll(query: TurfQueryDto) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.TurfWhereInput = {
      isActive: true,
      isApproved: true,
      deletedAt: null,
    };

    // City Filter
    if (query.cityId) {
      where.cityId = query.cityId;
    } else if (query.city) {
      where.city = {
        OR: [
          { slug: query.city.toLowerCase().trim() },
          { name: { contains: query.city.trim(), mode: 'insensitive' } },
        ],
      };
    }

    // Area Filter
    if (query.areaId) {
      where.areaId = query.areaId;
    }

    // Sport Filter
    if (query.sportId) {
      where.turfSports = {
        some: { sportId: query.sportId, isActive: true },
      };
    } else if (query.sport) {
      where.turfSports = {
        some: {
          sport: {
            OR: [
              { slug: query.sport.toLowerCase().trim() },
              { name: { contains: query.sport.trim(), mode: 'insensitive' } },
            ],
          },
          isActive: true,
        },
      };
    }

    // Facility / Amenity Filter
    const targetFacilityIds = query.facilityIds || query.amenities;
    if (targetFacilityIds && targetFacilityIds.length > 0) {
      const uniqueFacilityIds = [...new Set(targetFacilityIds)];
      where.AND = [
        ...(Array.isArray(where.AND)
          ? where.AND
          : where.AND
            ? [where.AND]
            : []),
        ...uniqueFacilityIds.map((facilityId) => ({
          turfFacilities: {
            some: {
              facilityId,
              isActive: true,
            },
          },
        })),
      ];
    }

    // Rating Filter
    if (query.minRating !== undefined && query.minRating > 0) {
      where.ratingAverage = { gte: query.minRating };
    }

    // Price Filter
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.pricingRules = {
        some: {
          isActive: true,
          hourlyPrice: {
            ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
            ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
          },
        },
      };
    }

    // Search Filter
    if (query.search) {
      const term = query.search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
        { addressLine: { contains: term, mode: 'insensitive' } },
      ];
    }

    // Sorting
    let orderBy: Prisma.TurfOrderByWithRelationInput | undefined = { createdAt: 'desc' };
    const sortOrder = query.sortOrder || 'desc';
    if (query.sortBy === 'rating') {
      orderBy = { ratingAverage: sortOrder };
    } else if (query.sortBy === 'reviews') {
      orderBy = { totalReviews: sortOrder };
    } else if (query.sortBy === 'name') {
      orderBy = { name: sortOrder };
    } else if (query.sortBy === 'distance') {
      // No DB orderBy needed; sorting will be done in-memory after distance calculation
      orderBy = undefined;
    }

    const [items, totalItems] = await Promise.all([
      this.prisma.turf.findMany({
        where,
        include: {
          city: true,
          area: true,
          images: {
            orderBy: { displayOrder: 'asc' },
          },
          turfSports: {
            where: { isActive: true },
            include: { sport: true },
          },
          turfFacilities: {
            where: { isActive: true },
            include: { facility: true },
          },
          pricingRules: {
            where: { isActive: true },
            orderBy: { hourlyPrice: 'asc' },
            take: 1,
          },
        },
        ...(orderBy ? { orderBy } : {}),
        skip,
        take: limit,
      }),
      this.prisma.turf.count({ where }),
    ]);

    const totalPages = Math.ceil(totalItems / limit) || 1;

    const enrichedItems = items.map((item) => {
      const amenities = (item.turfFacilities || [])
        .map((tf) => tf.facility?.name)
        .filter(Boolean);

      let distance: string | null = null;
      let distanceKm: number | null = null;
      if (
        query.latitude != null &&
        query.longitude != null &&
        item.latitude != null &&
        item.longitude != null
      ) {
        distanceKm = this.calculateDistanceKm(
          Number(query.latitude),
          Number(query.longitude),
          Number(item.latitude),
          Number(item.longitude),
        );
        distance = `${distanceKm.toFixed(1)} km`;
      }

      return {
        ...item,
        amenities,
        ...(distanceKm != null && { distanceKm, distance }),
      };
    });
      // Apply in-memory sorting for distance if requested
      if (query.sortBy === 'distance') {
        enrichedItems.sort((a, b) => {
          if (a.distanceKm == null && b.distanceKm == null) return 0;
          if (a.distanceKm == null) return 1; // nulls last
          if (b.distanceKm == null) return -1;
          return sortOrder === 'asc' ? a.distanceKm - b.distanceKm : b.distanceKm - a.distanceKm;
        });
      }
    return {
      items: enrichedItems,
      meta: {
        page,
        limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  // 2. GET /api/v1/turfs/:id
  async findOne(id: string) {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      );

    const turf = await this.prisma.turf.findFirst({
      where: {
        ...(isUuid ? { id } : { slug: id }),
        isActive: true,
        isApproved: true,
        deletedAt: null,
      },
      include: {
        owner: {
          select: {
            id: true,
            businessName: true,
            isVerified: true,
          },
        },
        city: true,
        area: true,
        images: {
          orderBy: { displayOrder: 'asc' },
        },
        videos: {
          orderBy: { displayOrder: 'asc' },
        },
        turfSports: {
          where: { isActive: true },
          include: { sport: true },
        },
        turfFacilities: {
          where: { isActive: true },
          include: { facility: true },
        },
        operatingHours: {
          orderBy: { dayOfWeek: 'asc' },
        },
        pricingRules: {
          where: { isActive: true },
          orderBy: { hourlyPrice: 'asc' },
        },
      },
    });

    if (!turf) {
      throw new NotFoundException(`Turf venue "${id}" not found`);
    }

    return {
      ...turf,
      amenities: (turf.turfFacilities || [])
        .map((tf) => tf.facility?.name)
        .filter(Boolean),
    };
  }

  // 3. GET /api/v1/turfs/search
  async search(query: TurfQueryDto) {
    return this.findAll(query);
  }

  // 4. GET /api/v1/turfs/nearby (Distance Filter via Haversine)
  async findNearby(dto: TurfNearbyDto) {
    const radiusKm = dto.radiusKm || 15;
    const page = Math.max(1, dto.page || 1);
    const limit = Math.min(100, Math.max(1, dto.limit || 20));

    // Fetch active approved turfs that possess coordinates
    const turfs = await this.prisma.turf.findMany({
      where: {
        isActive: true,
        isApproved: true,
        deletedAt: null,
        latitude: { not: null },
        longitude: { not: null },
      },
      include: {
        city: true,
        area: true,
        images: { orderBy: { displayOrder: 'asc' } },
        turfSports: { where: { isActive: true }, include: { sport: true } },
        turfFacilities: {
          where: { isActive: true },
          include: { facility: true },
        },
        pricingRules: { where: { isActive: true }, take: 1 },
      },
    });

    // Compute distance and filter within radius
    const withDistance = turfs
      .map((turf) => {
        const lat = Number(turf.latitude);
        const lon = Number(turf.longitude);
        const distanceKm = this.calculateDistanceKm(
          dto.latitude,
          dto.longitude,
          lat,
          lon,
        );
        return {
          ...turf,
          distanceKm,
          distance: `${distanceKm.toFixed(1)} km`,
          amenities: (turf.turfFacilities || [])
            .map((tf) => tf.facility?.name)
            .filter(Boolean),
        };
      })
      .filter((turf) => turf.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    const totalItems = withDistance.length;
    const totalPages = Math.ceil(totalItems / limit) || 1;
    const paginatedItems = withDistance.slice((page - 1) * limit, page * limit);

    return {
      items: paginatedItems,
      meta: {
        page,
        limit,
        totalItems,
        totalPages,
        searchRadiusKm: radiusKm,
        center: {
          latitude: dto.latitude,
          longitude: dto.longitude,
        },
      },
    };
  }

  // 5. GET /api/v1/turfs/featured
  async findFeatured(limit = 10) {
    const featured = await this.prisma.turf.findMany({
      where: {
        isFeatured: true,
        isActive: true,
        isApproved: true,
        deletedAt: null,
      },
      include: {
        city: true,
        area: true,
        images: { orderBy: { displayOrder: 'asc' } },
        turfSports: { where: { isActive: true }, include: { sport: true } },
      },
      take: limit,
      orderBy: { ratingAverage: 'desc' },
    });

    // If not enough featured turfs explicitly marked, fill with top-rated
    if (featured.length < limit) {
      const remainingLimit = limit - featured.length;
      const existingIds = featured.map((f) => f.id);

      const topRated = await this.prisma.turf.findMany({
        where: {
          id: { notIn: existingIds },
          isActive: true,
          isApproved: true,
          deletedAt: null,
        },
        include: {
          city: true,
          area: true,
          images: { orderBy: { displayOrder: 'asc' } },
          turfSports: { where: { isActive: true }, include: { sport: true } },
        },
        take: remainingLimit,
        orderBy: [{ ratingAverage: 'desc' }, { totalReviews: 'desc' }],
      });

      return [...featured, ...topRated];
    }

    return featured;
  }

  // 6. GET /api/v1/turfs/popular
  async findPopular(limit = 10) {
    return this.prisma.turf.findMany({
      where: {
        isActive: true,
        isApproved: true,
        deletedAt: null,
      },
      include: {
        city: true,
        area: true,
        images: { orderBy: { displayOrder: 'asc' } },
        turfSports: { where: { isActive: true }, include: { sport: true } },
      },
      orderBy: [{ totalReviews: 'desc' }, { ratingAverage: 'desc' }],
      take: limit,
    });
  }

  // 7. GET /api/v1/turfs/:id/sports
  async getTurfSports(id: string) {
    const turf = await this.findOne(id);
    const sports = await this.prisma.turfSport.findMany({
      where: { turfId: turf.id, isActive: true },
      include: { sport: true },
    });
    return sports.map((ts) => ts.sport);
  }

  // 8. GET /api/v1/turfs/:id/facilities
  async getTurfFacilities(id: string) {
    const turf = await this.findOne(id);
    const facilities = await this.prisma.turfFacility.findMany({
      where: { turfId: turf.id, isActive: true },
      include: { facility: true },
    });
    return facilities.map((tf) => tf.facility);
  }

  // 9. GET /api/v1/turfs/:id/images
  async getTurfImages(id: string) {
    const turf = await this.findOne(id);
    return this.prisma.turfImage.findMany({
      where: { turfId: turf.id },
      orderBy: { displayOrder: 'asc' },
    });
  }

  // 10. GET /api/v1/turfs/:id/rules
  async getTurfRules(id: string) {
    const turf = await this.findOne(id);
    return {
      turfId: turf.id,
      name: turf.name,
      rules: turf.rules || 'No specific rules set for this venue.',
    };
  }

  // 11. GET /api/v1/turfs/:id/policies
  async getTurfPolicies(id: string) {
    const turf = await this.findOne(id);
    return {
      turfId: turf.id,
      name: turf.name,
      cancellationPolicy:
        turf.cancellationPolicy ||
        'Standard platform cancellation policy: Full refund if cancelled 4 hours prior to game time.',
      rules: turf.rules || null,
    };
  }

  // 12. GET /api/v1/turfs/:id/cancellation-policy
  async getCancellationPolicy(id: string) {
    const turf = await this.prisma.turf.findUnique({
      where: { id },
      include: {
        cancellationPolicyRule: true,
      },
    });

    if (!turf) {
      throw new NotFoundException(`Turf with ID "${id}" not found`);
    }

    if (turf.cancellationPolicyRule) {
      const customRules = Array.isArray(turf.cancellationPolicyRule.rules)
        ? (turf.cancellationPolicyRule.rules as any[])
        : [
            {
              minHoursBefore: 24,
              refundPercentage: 100,
              fixedFee: 0,
              description:
                'Full refund (100%) if cancelled at least 24 hours prior to game time.',
            },
            {
              minHoursBefore: 12,
              refundPercentage: 75,
              fixedFee: 0,
              description:
                'Partial refund (75%) if cancelled between 12 and 24 hours prior to game time.',
            },
            {
              minHoursBefore: 4,
              refundPercentage: 50,
              fixedFee: 100,
              description:
                'Partial refund (50% minus ₹100 fee) if cancelled between 4 and 12 hours prior to game time.',
            },
            {
              minHoursBefore: 0,
              refundPercentage: 0,
              fixedFee: 0,
              description:
                'No refund (0%) if cancelled less than 4 hours prior to game time.',
            },
          ];

      return {
        turfId: turf.id,
        turfName: turf.name,
        freeCancellationHours:
          turf.cancellationPolicyRule.freeCancellationHours,
        fixedCancellationFee: Number(
          turf.cancellationPolicyRule.fixedCancellationFee,
        ),
        rules: customRules,
        description:
          turf.cancellationPolicyRule.description ||
          turf.cancellationPolicy ||
          'Standard Platform Cancellation Policy with tiered cancellation windows.',
      };
    }

    return {
      turfId: turf.id,
      turfName: turf.name,
      freeCancellationHours: 24,
      fixedCancellationFee: 0,
      rules: [
        {
          minHoursBefore: 24,
          refundPercentage: 100,
          fixedFee: 0,
          description:
            'Full refund (100%) if cancelled at least 24 hours prior to game time.',
        },
        {
          minHoursBefore: 12,
          refundPercentage: 75,
          fixedFee: 0,
          description:
            'Partial refund (75%) if cancelled between 12 and 24 hours prior to game time.',
        },
        {
          minHoursBefore: 4,
          refundPercentage: 50,
          fixedFee: 100,
          description:
            'Partial refund (50% minus ₹100 fee) if cancelled between 4 and 12 hours prior to game time.',
        },
        {
          minHoursBefore: 0,
          refundPercentage: 0,
          fixedFee: 0,
          description:
            'No refund (0%) if cancelled less than 4 hours prior to game time.',
        },
      ],
      description:
        turf.cancellationPolicy ||
        'Standard Platform Cancellation Policy with tiered cancellation windows.',
    };
  }

  // ===========================================================================
  // OWNER APIS (Strict multi-tenant owner authorization)
  // ===========================================================================

  // Helper to assert turf ownership
  private async assertTurfOwnership(
    turfId: string,
    userId: string,
    userRoles: string[],
  ) {
    const turf = await this.prisma.turf.findFirst({
      where: { id: turfId, deletedAt: null },
      include: { owner: true },
    });

    if (!turf) {
      throw new NotFoundException(`Turf venue with ID "${turfId}" not found`);
    }

    const isPlatformAdmin =
      userRoles.includes(Role.SUPER_ADMIN) || userRoles.includes(Role.ADMIN);

    // Multi-tenant security check: verify owner, assignment, or admin
    if (turf.owner.userId !== userId && !isPlatformAdmin) {
      const scope = await resolveManagedScope(this.prisma, userId, userRoles);
      if (!scope.turfIds.includes(turfId)) {
        this.logger.warn(
          `[Security Alert] User ${userId} attempted unauthorized access to Turf ${turfId} owned by user ${turf.owner.userId}`,
        );
        throw new ForbiddenException(
          'Access denied: You do not have permission to manage this turf venue',
        );
      }
    }

    return turf;
  }

  // 12. POST /api/v1/owner/turfs (Create Turf)
  async createOwnerTurf(
    userId: string,
    userRoles: string[],
    dto: CreateTurfDto,
  ) {
    // Only venue owners (or platform admins) may create venues — managers and
    // staff operate assigned turfs but must not spawn owner profiles.
    if (
      !userRoles.includes(Role.SUPER_ADMIN) &&
      !userRoles.includes(Role.ADMIN) &&
      !userRoles.includes(Role.TURF_OWNER)
    ) {
      throw new ForbiddenException(
        'Only turf owners can create new venues',
      );
    }
    const owner = await this.getOrCreateOwnerProfile(userId);
    const slug = await this.generateUniqueSlug(dto.name);

    // Validate City
    const city = await this.prisma.city.findUnique({
      where: { id: dto.cityId },
    });
    if (!city) {
      throw new BadRequestException(
        `City with ID "${dto.cityId}" does not exist`,
      );
    }

    // Validate Area if provided
    if (dto.areaId) {
      const area = await this.prisma.area.findUnique({
        where: { id: dto.areaId },
      });
      if (!area) {
        throw new BadRequestException(
          `Area with ID "${dto.areaId}" does not exist`,
        );
      }
    }

    const isPlatformAdmin =
      userRoles.includes(Role.SUPER_ADMIN) || userRoles.includes(Role.ADMIN);

    // Atomic creation with sports, facilities, hours, and pricing rules
    const turf = await this.prisma.$transaction(async (tx) => {
      const created = await tx.turf.create({
        data: {
          ownerId: owner.id,
          cityId: dto.cityId,
          areaId: dto.areaId || null,
          name: dto.name.trim(),
          slug,
          description: dto.description || null,
          addressLine: dto.addressLine.trim(),
          postalCode: dto.postalCode || null,
          latitude: dto.latitude ? new Prisma.Decimal(dto.latitude) : null,
          longitude: dto.longitude ? new Prisma.Decimal(dto.longitude) : null,
          contactPhone: dto.contactPhone || null,
          contactEmail: dto.contactEmail || null,
          coverImageUrl: dto.coverImageUrl || null,
          rules: dto.rules || null,
          cancellationPolicy: dto.cancellationPolicy || null,
          openTime: dto.openTime || '06:00',
          closeTime: dto.closeTime || '22:00',
          slotDurationMinutes: dto.slotDurationMinutes ?? 120,
          advancePaymentAllowed: dto.advancePaymentAllowed ?? true,
          minAdvancePercentage: dto.minAdvancePercentage !== undefined ? new Prisma.Decimal(dto.minAdvancePercentage) : new Prisma.Decimal(20.0),
          minAdvanceAmount: dto.minAdvanceAmount !== undefined ? new Prisma.Decimal(dto.minAdvanceAmount) : new Prisma.Decimal(0.0),
          isActive: true,
          // Platform admins can auto-approve; owners start pending
          isApproved: isPlatformAdmin,
          isFeatured: false,
        },
      });

      // Link sports
      if (dto.sportIds && dto.sportIds.length > 0) {
        await tx.turfSport.createMany({
          data: dto.sportIds.map((sportId) => ({
            turfId: created.id,
            sportId,
            isActive: true,
          })),
          skipDuplicates: true,
        });
      }

      // Link facilities
      if (dto.facilityIds && dto.facilityIds.length > 0) {
        await tx.turfFacility.createMany({
          data: dto.facilityIds.map((facilityId) => ({
            turfId: created.id,
            facilityId,
            isActive: true,
          })),
          skipDuplicates: true,
        });
      }

      // Create operating hours
      if (dto.operatingHours && dto.operatingHours.length > 0) {
        await tx.operatingHour.createMany({
          data: dto.operatingHours.map((oh) => ({
            turfId: created.id,
            dayOfWeek: oh.dayOfWeek,
            openTime: oh.openTime,
            closeTime: oh.closeTime,
            slotDurationMinutes: oh.slotDurationMinutes ?? dto.slotDurationMinutes ?? 120,
            isClosed: oh.isClosed || false,
          })),
          skipDuplicates: true,
        });
      } else {
        // Default operating hours: 06:00 to 22:00, 2-hour slots for all 7 days (0..6)
        const defaultHours = [];
        for (let d = 0; d < 7; d++) {
          defaultHours.push({
            turfId: created.id,
            dayOfWeek: d,
            openTime: dto.openTime || '06:00',
            closeTime: dto.closeTime || '22:00',
            slotDurationMinutes: dto.slotDurationMinutes ?? 120,
            isClosed: false,
          });
        }
        await tx.operatingHour.createMany({
          data: defaultHours,
          skipDuplicates: true,
        });
      }

      // Create pricing rules
      if (dto.pricingRules && dto.pricingRules.length > 0) {
        await tx.pricingRule.createMany({
          data: dto.pricingRules.map((pr) => ({
            turfId: created.id,
            sportId: pr.sportId || null,
            ruleName: pr.ruleName,
            dayType: pr.dayType || 'ALL',
            dayOfWeek: pr.dayOfWeek || null,
            startTime: pr.startTime,
            endTime: pr.endTime,
            hourlyPrice: new Prisma.Decimal(pr.hourlyPrice),
            isActive: true,
          })),
        });
      }

      // Create images
      if (dto.images && dto.images.length > 0) {
        await tx.turfImage.createMany({
          data: dto.images.map((img, idx) => ({
            turfId: created.id,
            imageUrl: img.imageUrl,
            caption: img.caption || null,
            displayOrder:
              img.displayOrder !== undefined ? img.displayOrder : idx,
            isCover: img.isCover || false,
          })),
        });
      }

      return created;
    });

    this.logger.log(
      `[Turf Created] New venue "${turf.name}" (${turf.id}) created by owner ${userId}`,
    );
    return this.findOwnerTurfById(userId, userRoles, turf.id);
  }

  // 13. GET /api/v1/owner/turfs (List My Turfs)
  async findOwnerTurfs(
    userId: string,
    userRoles: string[],
    pagination: PaginationQueryDto,
  ) {
    const owner = await this.getOrCreateOwnerProfile(userId);
    const page = Math.max(1, pagination.page || 1);
    const limit = Math.min(100, Math.max(1, pagination.limit || 20));
    const skip = (page - 1) * limit;

    const isPlatformAdmin =
      userRoles.includes(Role.SUPER_ADMIN) || userRoles.includes(Role.ADMIN);

    // Platform admin can see all; Owner sees only their owned venues
    const where: Prisma.TurfWhereInput = {
      deletedAt: null,
      ...(!isPlatformAdmin ? { ownerId: owner.id } : {}),
    };

    if (pagination.search) {
      where.OR = [
        { name: { contains: pagination.search, mode: 'insensitive' } },
        { addressLine: { contains: pagination.search, mode: 'insensitive' } },
      ];
    }

    const [items, totalItems] = await Promise.all([
      this.prisma.turf.findMany({
        where,
        include: {
          city: true,
          area: true,
          turfSports: { include: { sport: true } },
          turfFacilities: { include: { facility: true } },
          images: { where: { isCover: true }, take: 1 },
          _count: {
            select: {
              turfSports: true,
              turfFacilities: true,
              images: true,
              pricingRules: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.turf.count({ where }),
    ]);

    const totalPages = Math.ceil(totalItems / limit) || 1;

    return {
      items,
      meta: {
        page,
        limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  // 14. GET /api/v1/owner/turfs/:id (Get My Turf Details)
  async findOwnerTurfById(userId: string, userRoles: string[], id: string) {
    await this.assertTurfOwnership(id, userId, userRoles);

    return this.prisma.turf.findUnique({
      where: { id },
      include: {
        city: true,
        area: true,
        images: { orderBy: { displayOrder: 'asc' } },
        videos: { orderBy: { displayOrder: 'asc' } },
        turfSports: { include: { sport: true } },
        turfFacilities: { include: { facility: true } },
        operatingHours: { orderBy: { dayOfWeek: 'asc' } },
        pricingRules: true,
        blockedSlots: { orderBy: { blockDate: 'asc' } },
      },
    });
  }

  // 15. PUT /api/v1/owner/turfs/:id (Update Turf)
  async updateOwnerTurf(
    userId: string,
    userRoles: string[],
    id: string,
    dto: UpdateTurfDto,
  ) {
    await this.assertTurfOwnership(id, userId, userRoles);

    const updateData: Prisma.TurfUpdateInput = {};

    if (dto.name) updateData.name = dto.name.trim();
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.addressLine) updateData.addressLine = dto.addressLine.trim();
    if (dto.postalCode !== undefined) updateData.postalCode = dto.postalCode;
    if (dto.contactPhone !== undefined)
      updateData.contactPhone = dto.contactPhone;
    if (dto.contactEmail !== undefined)
      updateData.contactEmail = dto.contactEmail;
    if (dto.coverImageUrl !== undefined)
      updateData.coverImageUrl = dto.coverImageUrl;
    if (dto.rules !== undefined) updateData.rules = dto.rules;
    if (dto.cancellationPolicy !== undefined)
      updateData.cancellationPolicy = dto.cancellationPolicy;
    if (dto.openTime !== undefined) updateData.openTime = dto.openTime;
    if (dto.closeTime !== undefined) updateData.closeTime = dto.closeTime;
    if (dto.slotDurationMinutes !== undefined)
      updateData.slotDurationMinutes = dto.slotDurationMinutes;
    if (dto.advancePaymentAllowed !== undefined)
      updateData.advancePaymentAllowed = dto.advancePaymentAllowed;
    if (dto.minAdvancePercentage !== undefined)
      updateData.minAdvancePercentage = new Prisma.Decimal(dto.minAdvancePercentage);
    if (dto.minAdvanceAmount !== undefined)
      updateData.minAdvanceAmount = new Prisma.Decimal(dto.minAdvanceAmount);
    if (dto.latitude !== undefined) {
      updateData.latitude = dto.latitude
        ? new Prisma.Decimal(dto.latitude)
        : null;
    }
    if (dto.longitude !== undefined) {
      updateData.longitude = dto.longitude
        ? new Prisma.Decimal(dto.longitude)
        : null;
    }

    if (dto.cityId) {
      const city = await this.prisma.city.findUnique({
        where: { id: dto.cityId },
      });
      if (!city) throw new BadRequestException('Invalid cityId');
      updateData.city = { connect: { id: dto.cityId } };
    }

    if (dto.areaId) {
      const area = await this.prisma.area.findUnique({
        where: { id: dto.areaId },
      });
      if (!area) throw new BadRequestException('Invalid areaId');
      updateData.area = { connect: { id: dto.areaId } };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.turf.update({
        where: { id },
        data: updateData,
      });

      // Update sports if provided
      if (dto.sportIds) {
        await tx.turfSport.deleteMany({ where: { turfId: id } });
        if (dto.sportIds.length > 0) {
          await tx.turfSport.createMany({
            data: dto.sportIds.map((sportId) => ({
              turfId: id,
              sportId,
              isActive: true,
            })),
          });
        }
      }

      // Update facilities if provided
      if (dto.facilityIds) {
        await tx.turfFacility.deleteMany({ where: { turfId: id } });
        if (dto.facilityIds.length > 0) {
          await tx.turfFacility.createMany({
            data: dto.facilityIds.map((facilityId) => ({
              turfId: id,
              facilityId,
              isActive: true,
            })),
          });
        }
      }

      // Update operating hours if provided
      if (dto.operatingHours) {
        await tx.operatingHour.deleteMany({ where: { turfId: id } });
        if (dto.operatingHours.length > 0) {
          await tx.operatingHour.createMany({
            data: dto.operatingHours.map((oh) => ({
              turfId: id,
              dayOfWeek: oh.dayOfWeek,
              openTime: oh.openTime,
              closeTime: oh.closeTime,
              slotDurationMinutes: oh.slotDurationMinutes ?? dto.slotDurationMinutes ?? 120,
              isClosed: oh.isClosed || false,
            })),
          });
        }
      }

      // Update pricing rules if provided
      if (dto.pricingRules) {
        await tx.pricingRule.deleteMany({ where: { turfId: id } });
        if (dto.pricingRules.length > 0) {
          await tx.pricingRule.createMany({
            data: dto.pricingRules.map((pr) => ({
              turfId: id,
              sportId: pr.sportId || null,
              ruleName: pr.ruleName,
              dayType: pr.dayType || 'ALL',
              dayOfWeek: pr.dayOfWeek || null,
              startTime: pr.startTime,
              endTime: pr.endTime,
              hourlyPrice: new Prisma.Decimal(pr.hourlyPrice),
              isActive: true,
            })),
          });
        }
      }
    });

    return this.findOwnerTurfById(userId, userRoles, id);
  }

  // 16. DELETE /api/v1/owner/turfs/:id (Soft Delete)
  async deleteOwnerTurf(userId: string, userRoles: string[], id: string) {
    await this.assertTurfOwnership(id, userId, userRoles);

    await this.prisma.turf.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });

    this.logger.log(`[Turf Deleted] Turf ${id} soft-deleted by user ${userId}`);

    return {
      success: true,
      message: 'Turf venue has been successfully deleted',
    };
  }

  // 17. PATCH /api/v1/owner/turfs/:id/status (Toggle Status)
  async updateOwnerTurfStatus(
    userId: string,
    userRoles: string[],
    id: string,
    dto: UpdateTurfStatusDto,
  ) {
    await this.assertTurfOwnership(id, userId, userRoles);

    const updated = await this.prisma.turf.update({
      where: { id },
      data: { isActive: dto.isActive },
    });

    return {
      success: true,
      message: `Turf status successfully updated to ${dto.isActive ? 'active' : 'inactive'}`,
      turfId: updated.id,
      isActive: updated.isActive,
    };
  }

  // 18. POST /api/v1/owner/turfs/:id/images (Attach image URL)
  async addOwnerTurfImage(
    turfId: string,
    userId: string,
    userRoles: string[],
    dto: TurfImageInputDto,
  ) {
    await this.assertTurfOwnership(turfId, userId, userRoles);

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
          caption: dto.caption || null,
          displayOrder: dto.displayOrder ?? (maxOrder._max.displayOrder ?? -1) + 1,
          isCover: dto.isCover ?? false,
        },
      });
    });

    this.logger.log(`[Turf Image] User ${userId} added image ${image.id} to turf ${turfId}`);
    return image;
  }

  // 19. POST /api/v1/owner/turfs/:id/images/upload (Upload image file)
  async uploadOwnerTurfImage(
    turfId: string,
    userId: string,
    userRoles: string[],
    file: { buffer: Buffer; mimetype: string; originalname: string; size: number },
    caption?: string,
  ) {
    await this.assertTurfOwnership(turfId, userId, userRoles);

    const existingCount = await this.prisma.turfImage.count({
      where: { turfId },
    });

    const imageUrl = await this.uploadsService.uploadTurfImage(
      file.buffer,
      file.mimetype,
      file.originalname,
      file.size,
    );

    return this.addOwnerTurfImage(
      turfId,
      userId,
      userRoles,
      { imageUrl, caption, isCover: existingCount === 0 },
    );
  }

  // 18b. POST /api/v1/owner/turfs/:id/videos (Attach video URL)
  async addOwnerTurfVideo(
    turfId: string,
    userId: string,
    userRoles: string[],
    dto: { videoUrl: string; thumbnailUrl?: string; title?: string },
  ) {
    await this.assertTurfOwnership(turfId, userId, userRoles);
    if (!dto?.videoUrl || typeof dto.videoUrl !== 'string')
      throw new BadRequestException('videoUrl is required');

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

    this.logger.log(`[Turf Video] User ${userId} added video ${video.id} to turf ${turfId}`);
    return video;
  }

  // 18c. DELETE /api/v1/owner/turfs/:id/videos/:videoId (Remove video)
  async deleteOwnerTurfVideo(
    turfId: string,
    userId: string,
    userRoles: string[],
    videoId: string,
  ) {
    await this.assertTurfOwnership(turfId, userId, userRoles);

    const video = await this.prisma.turfVideo.findFirst({
      where: { id: videoId, turfId },
    });
    if (!video) throw new NotFoundException('Turf video not found');

    await this.prisma.turfVideo.delete({ where: { id: videoId } });

    this.logger.log(`[Turf Video] User ${userId} deleted video ${videoId} from turf ${turfId}`);
    return { success: true, message: 'Turf video deleted successfully' };
  }

  // 19b. POST /api/v1/owner/turfs/:id/videos/upload (Upload video file)
  async uploadOwnerTurfVideo(
    turfId: string,
    userId: string,
    userRoles: string[],
    file: { buffer: Buffer; mimetype: string; originalname: string; size: number },
    title?: string,
  ) {
    await this.assertTurfOwnership(turfId, userId, userRoles);

    const videoUrl = await this.uploadsService.uploadTurfVideo(
      file.buffer,
      file.mimetype,
      file.originalname,
      file.size,
    );

    const maxOrder = await this.prisma.turfVideo.aggregate({
      where: { turfId },
      _max: { displayOrder: true },
    });

    const video = await this.prisma.turfVideo.create({
      data: {
        turfId,
        videoUrl,
        thumbnailUrl: null,
        title: title?.trim() || null,
        displayOrder: (maxOrder._max.displayOrder ?? -1) + 1,
      },
    });

    this.logger.log(`[Turf Video] User ${userId} uploaded video ${video.id} to turf ${turfId}`);
    return video;
  }

  // 20. POST /api/v1/owner/turfs/:id/images/:imageId/cover (Promote cover)
  async setOwnerTurfCover(
    turfId: string,
    userId: string,
    userRoles: string[],
    imageId: string,
  ) {
    await this.assertTurfOwnership(turfId, userId, userRoles);

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

    return { success: true, message: 'Cover image updated successfully' };
  }

  // 21. DELETE /api/v1/owner/turfs/:id/images/:imageId (Remove image)
  async deleteOwnerTurfImage(
    turfId: string,
    userId: string,
    userRoles: string[],
    imageId: string,
  ) {
    await this.assertTurfOwnership(turfId, userId, userRoles);

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

    this.logger.log(`[Turf Image] User ${userId} deleted image ${imageId} from turf ${turfId}`);
    return { success: true, message: 'Turf image deleted successfully' };
  }
}
