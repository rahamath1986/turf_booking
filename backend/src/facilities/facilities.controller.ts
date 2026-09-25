import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { FacilitiesService } from './facilities.service';

@ApiTags('Facilities')
@Controller('facilities')
export class FacilitiesController {
  constructor(private readonly facilitiesService: FacilitiesService) {}

  @Get('amenities')
  @ApiOperation({ summary: 'List platform-standard facility amenities' })
  getAmenities() {
    return this.facilitiesService.getStandardAmenities();
  }
}
