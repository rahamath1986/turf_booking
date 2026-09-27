import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { LocationsService } from './locations.service';
import { PrismaService } from '../database/prisma.service';

describe('LocationsService', () => {
  let service: LocationsService;

  const mockPrisma = {
    city: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    area: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocationsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<LocationsService>(LocationsService);
    jest.clearAllMocks();
  });

  describe('getActiveCities', () => {
    it('should return list of active cities', async () => {
      const mockCities = [
        { id: 'city-1', name: 'Bengaluru', slug: 'bengaluru', isActive: true },
        { id: 'city-2', name: 'Mumbai', slug: 'mumbai', isActive: true },
      ];
      mockPrisma.city.findMany.mockResolvedValue(mockCities);

      const result = await service.getActiveCities();

      expect(mockPrisma.city.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      });
      expect(result).toEqual(mockCities);
    });
  });

  describe('getAreasByCity', () => {
    const mockCity = {
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      name: 'Bengaluru',
      slug: 'bengaluru',
      isActive: true,
    };

    const mockAreas = [
      {
        id: 'area-1',
        cityId: mockCity.id,
        name: 'Indiranagar',
        slug: 'indiranagar',
        postalCode: '560038',
        isActive: true,
      },
      {
        id: 'area-2',
        cityId: mockCity.id,
        name: 'Koramangala',
        slug: 'koramangala',
        postalCode: '560034',
        isActive: true,
      },
    ];

    it('should return areas when queried by city UUID', async () => {
      mockPrisma.city.findFirst.mockResolvedValue(mockCity);
      mockPrisma.area.findMany.mockResolvedValue(mockAreas);

      const result = await service.getAreasByCity(mockCity.id);

      expect(mockPrisma.city.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockCity.id,
          isActive: true,
        },
      });
      expect(mockPrisma.area.findMany).toHaveBeenCalledWith({
        where: {
          cityId: mockCity.id,
          isActive: true,
        },
        orderBy: { name: 'asc' },
      });
      expect(result).toEqual(mockAreas);
    });

    it('should return areas when queried by city slug', async () => {
      mockPrisma.city.findFirst.mockResolvedValue(mockCity);
      mockPrisma.area.findMany.mockResolvedValue(mockAreas);

      const result = await service.getAreasByCity('bengaluru');

      expect(mockPrisma.city.findFirst).toHaveBeenCalledWith({
        where: {
          slug: 'bengaluru',
          isActive: true,
        },
      });
      expect(mockPrisma.area.findMany).toHaveBeenCalledWith({
        where: {
          cityId: mockCity.id,
          isActive: true,
        },
        orderBy: { name: 'asc' },
      });
      expect(result).toEqual(mockAreas);
    });

    it('should throw NotFoundException if city does not exist', async () => {
      mockPrisma.city.findFirst.mockResolvedValue(null);

      await expect(service.getAreasByCity('non-existent-city')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.area.findMany).not.toHaveBeenCalled();
    });
  });
});
