import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { OwnersService } from './owners.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';

@ApiTags('Owner Analytics & Dashboard')
@Controller('owner/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TURF_OWNER, Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN)
@ApiBearerAuth('JWT-auth')
export class OwnersDashboardController {
  constructor(private readonly ownersService: OwnersService) {}

  @Get()
  @ApiOperation({
    summary: 'Executive dashboard overview for turf owner',
    description:
      'Provides high-level KPIs including today and monthly revenue, total bookings, occupancy rate, cancellations, and recent match bookings.',
  })
  @ApiResponse({ status: 200, description: 'Executive dashboard metrics' })
  getDashboardSummary(
    @CurrentUser('userId') userId: string,
    @CurrentUser('roles') userRoles: string[],
  ) {
    return this.ownersService.getDashboardSummary(userId, userRoles);
  }

  @Get('revenue')
  @ApiOperation({
    summary: 'Daily and monthly revenue analytics',
    description:
      'Aggregates revenue trends grouped by day, month, and breakdown per turf venue.',
  })
  @ApiResponse({ status: 200, description: 'Revenue analytics breakdown' })
  getRevenueAnalytics(
    @CurrentUser('userId') userId: string,
    @CurrentUser('roles') userRoles: string[],
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.ownersService.getRevenueAnalytics(userId, userRoles, query);
  }

  @Get('bookings')
  @ApiOperation({
    summary: 'Booking volume and status breakdown',
    description:
      'Returns total bookings, status distribution (CONFIRMED, COMPLETED, CANCELLED), cancellation rates, and daily volume trends.',
  })
  @ApiResponse({ status: 200, description: 'Bookings analytics' })
  getBookingsAnalytics(
    @CurrentUser('userId') userId: string,
    @CurrentUser('roles') userRoles: string[],
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.ownersService.getBookingsAnalytics(userId, userRoles, query);
  }

  @Get('occupancy')
  @ApiOperation({
    summary: 'Venue occupancy and utilization metrics',
    description:
      'Calculates booked slot hours against total operational hours to measure venue utilization.',
  })
  @ApiResponse({ status: 200, description: 'Occupancy analytics' })
  getOccupancyAnalytics(
    @CurrentUser('userId') userId: string,
    @CurrentUser('roles') userRoles: string[],
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.ownersService.getOccupancyAnalytics(userId, userRoles, query);
  }

  @Get('peak-hours')
  @ApiOperation({
    summary: 'Peak hours and popular slots analysis',
    description:
      'Analyzes booking frequency across each hour of the day (morning, afternoon, evening, night) and top sports.',
  })
  @ApiResponse({ status: 200, description: 'Peak hours analytics' })
  getPeakHoursAnalytics(
    @CurrentUser('userId') userId: string,
    @CurrentUser('roles') userRoles: string[],
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.ownersService.getPeakHoursAnalytics(userId, userRoles, query);
  }
}
