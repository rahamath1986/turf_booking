import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TurfsService } from './turfs.service';
import { PrismaService } from '../database/prisma.service';
import { Role } from '../common/enums/role.enum';

describe('TurfsService', () => {
  let service: TurfsService;
  let prisma: PrismaService;

  const mockTurf = {
    id: 'turf-1',
    name: 'Spartan Arena',
    slug: 'spartan-arena',
    ownerId: 'owner-profile-1',
    cityId: 'city-1',
    areaId: 'area-1',
    addressLine: '80 Feet Road',
    latitude: 12.9352,
    longitude: 77.6245,
    ratingAverage: 4.8,
    totalReviews: 25,
    isActive: true,
    isApproved: true,
    isFeatured: true,
    rules: 'No metal studs',
    cancellationPolicy: '4h cancellation',
    deletedAt: null,
    owner: {
      id: 'owner-profile-1',
      userId: 'user-owner-1',
      businessName: 'Spartan Arena Group',
      isVerified: true,
    },
    city: { id: 'city-1', name: 'Bengaluru', slug: 'bengaluru' },
    area: { id: 'area-1', name: 'Koramangala' },
    turfSports: [],
    turfFacilities: [],
    operatingHours: [],
    pricingRules: [],
    images: [],
  };

  const mockPrismaService: any = {
    turf: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    turfOwner: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    city: {
      findUnique: jest.fn(),
    },
    area: {
      findUnique: jest.fn(),
    },
    turfSport: {
      findMany: jest.fn(),
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    turfFacility: {
      findMany: jest.fn(),
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    turfImage: {
      findMany: jest.fn(),
      createMany: jest.fn(),
    },
    operatingHour: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    pricingRule: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn((callback) => {
      if (typeof callback === 'function') {
        return callback(mockPrismaService);
      }
      return Promise.all(callback);
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TurfsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<TurfsService>(TurfsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(prisma).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated turfs', async () => {
      mockPrismaService.turf.findMany.mockResolvedValue([mockTurf]);
      mockPrismaService.turf.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 } as any);
      expect(result.items).toHaveLength(1);
      expect(result.meta.totalItems).toBe(1);
      expect(result.meta.page).toBe(1);
    });
  });

  describe('findOne', () => {
    it('should return turf by ID', async () => {
      mockPrismaService.turf.findFirst.mockResolvedValue(mockTurf);

      const result = await service.findOne('turf-1');
      expect(result.name).toBe('Spartan Arena');
    });

    it('should throw NotFoundException if turf does not exist', async () => {
      mockPrismaService.turf.findFirst.mockResolvedValue(null);

      await expect(service.findOne('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findNearby', () => {
    it('should calculate distance and filter within radius', async () => {
      mockPrismaService.turf.findMany.mockResolvedValue([
        {
          ...mockTurf,
          latitude: 12.9352,
          longitude: 77.6245,
        },
      ]);

      const result = await service.findNearby({
        latitude: 12.934,
        longitude: 77.624,
        radiusKm: 5,
      } as any);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].distanceKm).toBeLessThan(1);
      expect(result.meta.searchRadiusKm).toBe(5);
    });
  });

  describe('Multi-Tenant Owner Authorization', () => {
    it('should allow owner to access their own turf', async () => {
      mockPrismaService.turf.findFirst.mockResolvedValue(mockTurf);
      mockPrismaService.turf.findUnique.mockResolvedValue(mockTurf);

      const result = await service.findOwnerTurfById(
        'user-owner-1',
        [Role.TURF_OWNER],
        'turf-1',
      );
      expect(result).toBeDefined();
      expect(result?.id).toBe('turf-1');
    });

    it('should throw ForbiddenException if Owner B attempts to access Owner A turf', async () => {
      mockPrismaService.turf.findFirst.mockResolvedValue(mockTurf);

      await expect(
        service.findOwnerTurfById(
          'user-owner-2', // Different user!
          [Role.TURF_OWNER],
          'turf-1',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow platform SUPER_ADMIN to access any turf', async () => {
      mockPrismaService.turf.findFirst.mockResolvedValue(mockTurf);
      mockPrismaService.turf.findUnique.mockResolvedValue(mockTurf);

      const result = await service.findOwnerTurfById(
        'super-admin-user',
        [Role.SUPER_ADMIN],
        'turf-1',
      );
      expect(result).toBeDefined();
    });
  });
});
