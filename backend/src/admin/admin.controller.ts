import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  AdminUserQueryDto,
  AdminOwnerQueryDto,
  AdminTurfQueryDto,
  AdminBookingQueryDto,
  AdminReportQueryDto,
  AdminActionReasonDto,
  AdminUpdateUserStatusDto,
} from './dto/admin-query.dto';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ============================================================================
  // PLATFORM STATS
  // ============================================================================

  @Get('stats')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Platform-level operational statistics' })
  getStats() {
    return this.adminService.getPlatformStats();
  }

  // ============================================================================
  // USER MANAGEMENT
  // ============================================================================

  @Get('users')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all users with filters and search' })
  listUsers(@Query() query: AdminUserQueryDto) {
    return this.adminService.listUsers(query);
  }

  @Get('users/:id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get user details by ID' })
  getUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getUserById(id);
  }

  @Patch('users/:id/status')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Activate or deactivate a user account' })
  updateUserStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminUpdateUserStatusDto,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.adminService.updateUserStatus(id, dto.isActive, adminId);
  }

  // ============================================================================
  // OWNER MANAGEMENT
  // ============================================================================

  @Get('owners')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all turf owners with filters' })
  listOwners(@Query() query: AdminOwnerQueryDto) {
    return this.adminService.listOwners(query);
  }

  @Get('owners/:id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get turf owner details' })
  getOwner(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getOwnerById(id);
  }

  @Post('owners/:id/approve')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Approve and verify a turf owner' })
  approveOwner(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.adminService.approveOwner(id, adminId);
  }

  @Post('owners/:id/reject')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Reject a turf owner application' })
  rejectOwner(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminActionReasonDto,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.adminService.rejectOwner(id, dto.reason ?? '', adminId);
  }

  @Post('owners/:id/suspend')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Suspend a turf owner account' })
  suspendOwner(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminActionReasonDto,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.adminService.suspendOwner(id, dto.reason ?? '', adminId);
  }

  // ============================================================================
  // TURF MANAGEMENT
  // ============================================================================

  @Get('turfs')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all turfs with filters' })
  listTurfs(@Query() query: AdminTurfQueryDto) {
    return this.adminService.listTurfs(query);
  }

  @Get('turfs/:id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get turf venue details' })
  getTurf(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getTurfById(id);
  }

  @Post('turfs/:id/approve')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Approve a turf venue for the platform' })
  approveTurf(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.adminService.approveTurf(id, adminId);
  }

  @Post('turfs/:id/reject')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Reject a turf venue listing' })
  rejectTurf(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminActionReasonDto,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.adminService.rejectTurf(id, dto.reason ?? '', adminId);
  }

  @Post('turfs/:id/suspend')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Suspend a turf venue' })
  suspendTurf(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminActionReasonDto,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.adminService.suspendTurf(id, dto.reason ?? '', adminId);
  }

  // ============================================================================
  // BOOKING MANAGEMENT
  // ============================================================================

  @Get('bookings')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all bookings with advanced filters' })
  listBookings(@Query() query: AdminBookingQueryDto) {
    return this.adminService.listBookings(query);
  }

  @Get('bookings/:id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get full booking detail with payments, refunds, audits' })
  getBooking(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getBookingById(id);
  }

  // ============================================================================
  // REPORTS
  // ============================================================================

  @Get('reports/revenue')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Revenue report grouped by day/week/month' })
  getRevenueReport(@Query() query: AdminReportQueryDto) {
    return this.adminService.getRevenueReport(query);
  }

  @Get('reports/bookings')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Bookings report by status and trend' })
  getBookingsReport(@Query() query: AdminReportQueryDto) {
    return this.adminService.getBookingsReport(query);
  }

  @Get('reports/users')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'User growth and role distribution report' })
  getUsersReport(@Query() query: AdminReportQueryDto) {
    return this.adminService.getUsersReport(query);
  }

  @Get('reports/turfs')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Turf venue report by city and approval status' })
  getTurfsReport(@Query() query: AdminReportQueryDto) {
    return this.adminService.getTurfsReport(query);
  }

  @Get('reports/commission')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Commission earnings report' })
  getCommissionReport(@Query() query: AdminReportQueryDto) {
    return this.adminService.getCommissionReport(query);
  }

  @Get('reports/refunds')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Refunds report by status and amount' })
  getRefundsReport(@Query() query: AdminReportQueryDto) {
    return this.adminService.getRefundsReport(query);
  }
}
