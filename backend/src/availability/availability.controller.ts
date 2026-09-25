import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AvailabilityService } from './availability.service';
import { AvailabilityQueryDto } from './dto/availability-query.dto';
import { AvailableSlotsQueryDto } from './dto/available-slots-query.dto';

@ApiTags('Turf Availability & Pricing')
@Controller('turfs')
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Get(':id/availability')
  @ApiOperation({
    summary: 'Get high-level turf availability calendar and operating status',
    description:
      'Returns open/closed statuses, daily operating hours, and slot availability summary counts over a date range.',
  })
  @ApiResponse({ status: 200, description: 'Turf availability schedule' })
  @ApiResponse({ status: 404, description: 'Turf venue not found' })
  getAvailability(
    @Param('id') id: string,
    @Query() query: AvailabilityQueryDto,
  ) {
    return this.availabilityService.getTurfAvailability(id, query);
  }

  @Get(':id/available-slots')
  @ApiOperation({
    summary: 'Calculate available timeslots and dynamic pricing on-the-fly',
    description:
      'Calculates slot availability on-the-fly without database bloat. Applies dynamic pricing hierarchy (weekday, weekend, peak, off-peak, holiday, special).',
  })
  @ApiResponse({
    status: 200,
    description: 'Calculated timeslots with dynamic pricing',
  })
  @ApiResponse({ status: 404, description: 'Turf venue not found' })
  getAvailableSlots(
    @Param('id') id: string,
    @Query() query: AvailableSlotsQueryDto,
  ) {
    return this.availabilityService.getAvailableSlots(id, query);
  }

  @Get(':id/pricing')
  @ApiOperation({
    summary: 'Get turf pricing rules and rate matrix',
    description:
      'Returns active pricing rules including weekday, weekend, peak-hour, holiday, and special event rates.',
  })
  @ApiResponse({ status: 200, description: 'Turf pricing matrix' })
  @ApiResponse({ status: 404, description: 'Turf venue not found' })
  getPricing(@Param('id') id: string) {
    return this.availabilityService.getTurfPricing(id);
  }
}
