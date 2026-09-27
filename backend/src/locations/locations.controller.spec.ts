import { Test, TestingModule } from '@nestjs/testing';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';

describe('LocationsController', () => {
  let controller: LocationsController;
  let service: LocationsService;

  const mockLocationsService = {
    getActiveCities: jest.fn(),
    getAreasByCity: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LocationsController],
      providers: [
        { provide: LocationsService, useValue: mockLocationsService },
      ],
    }).compile();

    controller = module.get<LocationsController>(LocationsController);
    service = module.get<LocationsService>(LocationsService);
    jest.clearAllMocks();
  });

  describe('getCities', () => {
    it('should delegate to locationsService.getActiveCities', async () => {
      const mockCities = [{ id: '1', name: 'Bengaluru' }];
      mockLocationsService.getActiveCities.mockResolvedValue(mockCities);

      const result = await controller.getCities();

      expect(service.getActiveCities).toHaveBeenCalled();
      expect(result).toEqual(mockCities);
    });
  });

  describe('getAreasByCity', () => {
    it('should delegate to locationsService.getAreasByCity with id param', async () => {
      const mockAreas = [{ id: 'area-1', name: 'Koramangala' }];
      mockLocationsService.getAreasByCity.mockResolvedValue(mockAreas);

      const result = await controller.getAreasByCity('bengaluru');

      expect(service.getAreasByCity).toHaveBeenCalledWith('bengaluru');
      expect(result).toEqual(mockAreas);
    });
  });
});
