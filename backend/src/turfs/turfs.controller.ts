import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TurfsService } from './turfs.service';
import { TurfQueryDto } from './dto/turf-query.dto';
import { TurfNearbyDto } from './dto/turf-nearby.dto';

@ApiTags('Turfs')
@Controller('turfs')
export class TurfsController {
  constructor(private readonly turfsService: TurfsService) {}

  @Get()
  @ApiOperation({
    summary: 'Browse and filter active turfs',
    description:
      'Returns paginated turfs filtered by city, sport, rating, and price.',
  })
  @ApiResponse({ status: 200, description: 'Paginated turf venues' })
  findAll(@Query() query: TurfQueryDto) {
    return this.turfsService.findAll(query);
  }

  @Get('search')
  @ApiOperation({
    summary: 'Search turfs by keywords',
    description:
      'Full-text query search matching venue name, description, address, city, or sports.',
  })
  @ApiResponse({ status: 200, description: 'Matching turf search results' })
  search(@Query() query: TurfQueryDto) {
    return this.turfsService.search(query);
  }

  @Get('nearby')
  @ApiOperation({
    summary: 'Discover nearby turfs using geographic coordinates',
    description:
      'Computes distance using the Haversine formula and returns venues within the requested radius.',
  })
  @ApiResponse({ status: 200, description: 'Nearest turfs sorted by distance' })
  findNearby(@Query() query: TurfNearbyDto) {
    return this.turfsService.findNearby(query);
  }

  @Get('featured')
  @ApiOperation({
    summary: 'List curated featured turfs',
    description: 'Returns featured venues curated by platform administrators.',
  })
  @ApiResponse({ status: 200, description: 'Featured turfs' })
  findFeatured(@Query('limit') limit?: number) {
    return this.turfsService.findFeatured(limit ? Number(limit) : 10);
  }

  @Get('popular')
  @ApiOperation({
    summary: 'List popular top-rated turfs',
    description:
      'Returns highest-rated venues sorted by review count and rating.',
  })
  @ApiResponse({ status: 200, description: 'Popular turfs' })
  findPopular(@Query('limit') limit?: number) {
    return this.turfsService.findPopular(limit ? Number(limit) : 10);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get turf venue details by ID or Slug',
    description:
      'Retrieves complete turf overview including images, sports, amenities, and operating hours.',
  })
  @ApiResponse({ status: 200, description: 'Detailed turf profile' })
  @ApiResponse({ status: 404, description: 'Turf venue not found' })
  findOne(@Param('id') id: string) {
    return this.turfsService.findOne(id);
  }

  @Get(':id/sports')
  @ApiOperation({ summary: 'List sports playable at a specific turf' })
  @ApiResponse({ status: 200, description: 'List of supported sports' })
  getSports(@Param('id') id: string) {
    return this.turfsService.getTurfSports(id);
  }

  @Get(':id/facilities')
  @ApiOperation({ summary: 'List facilities and amenities at a specific turf' })
  @ApiResponse({ status: 200, description: 'List of available facilities' })
  getFacilities(@Param('id') id: string) {
    return this.turfsService.getTurfFacilities(id);
  }

  @Get(':id/images')
  @ApiOperation({ summary: 'Retrieve high-res gallery images for a turf' })
  @ApiResponse({ status: 200, description: 'Array of gallery images' })
  getImages(@Param('id') id: string) {
    return this.turfsService.getTurfImages(id);
  }

  @Get(':id/rules')
  @ApiOperation({
    summary: 'Get ground rules and footwear guidelines for a turf',
  })
  @ApiResponse({ status: 200, description: 'Venue rules' })
  getRules(@Param('id') id: string) {
    return this.turfsService.getTurfRules(id);
  }

  @Get(':id/policies')
  @ApiOperation({
    summary: 'Get booking, cancellation, and refund policies for a turf',
  })
  @ApiResponse({ status: 200, description: 'Venue policies' })
  getPolicies(@Param('id') id: string) {
    return this.turfsService.getTurfPolicies(id);
  }

  @Get(':id/cancellation-policy')
  @ApiOperation({
    summary: 'Get structured cancellation and refund policy for a turf',
    description:
      'Returns the tiered cancellation rules, free cancellation window, and fixed fees for the venue.',
  })
  @ApiResponse({ status: 200, description: 'Turf cancellation policy' })
  @ApiResponse({ status: 404, description: 'Turf not found' })
  getCancellationPolicy(@Param('id') id: string) {
    return this.turfsService.getCancellationPolicy(id);
  }
}
