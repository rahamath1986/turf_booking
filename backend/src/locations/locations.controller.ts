import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LocationsService } from './locations.service';

@ApiTags('Locations')
@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get('cities')
  @ApiOperation({ summary: 'List all operational cities' })
  @ApiResponse({ status: 200, description: 'List of active cities' })
  getCities() {
    return this.locationsService.getActiveCities();
  }

  @Get('cities/:id/areas')
  @ApiOperation({ summary: 'List all active areas or localities in a city' })
  @ApiParam({
    name: 'id',
    description: 'City ID (UUID) or city slug (e.g. bengaluru)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of active areas/localities belonging to the city',
  })
  @ApiResponse({ status: 404, description: 'City not found' })
  getAreasByCity(@Param('id') id: string) {
    return this.locationsService.getAreasByCity(id);
  }
}
