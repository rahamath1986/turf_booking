import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Express } from 'express';
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
  AdminReviewQueryDto,
  AdminRefundQueryDto,
  AdminProcessRefundDto,
  AdminActionReasonDto,
  AdminUpdateUserStatusDto,
  AdminResetPasswordDto,
  AdminAddTurfVideoDto,
  AdminAssignStaffDto,
  AdminBroadcastDto,
} from './dto/admin-query.dto';
import { SetAvailabilityDto } from '../availability/dto/set-operating-hours.dto';
import { BlockSlotDto } from '../availability/dto/block-slot.dto';
import {
  AdminCreateOwnerDto,
  AdminUpdateOwnerDto,
} from './dto/admin-owner.dto';
import { AdminCreateUserDto } from './dto/admin-user.dto';
import {
  AdminAddTurfImageDto,
  AdminCreateBookingDto,
  AdminCreateTurfDto,
  AdminUpdateTurfDto,
} from './dto/admin-turf.dto';
import {
  AdminCreateFacilityDto,
  AdminCreateSportDto,
  AdminUpdateFacilityDto,
  AdminUpdateSportDto,
} from './dto/admin-catalog.dto';
import {
  AdminCreateAreaDto,
  AdminCreateCityDto,
  AdminCreateCountryDto,
  AdminCreateStateDto,
  AdminUpdateAreaDto,
  AdminUpdateCityDto,
  AdminUpdateCountryDto,
  AdminUpdateStateDto,
} from './dto/admin-location.dto';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

class AdminUploadTurfImageBodyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  caption?: string;
}

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

  @Post('users')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a user with roles (defaults to CUSTOMER)' })
  createUser(
    @Body() dto: AdminCreateUserDto,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.adminService.createUser(dto, adminId);
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

  @Delete('users/:id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Soft-delete a user (SUPER_ADMIN only)' })
  deleteUser(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.adminService.deleteUser(id, adminId);
  }

  @Post('users/:id/reset-password')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Reset a user password (revokes sessions)' })
  resetUserPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminResetPasswordDto,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.adminService.resetUserPassword(id, dto.newPassword, adminId);
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

  @Post('owners')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Create a turf owner (defaults to unverified + inactive)',
  })
  createOwner(
    @Body() dto: AdminCreateOwnerDto,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.adminService.createOwner(dto, adminId);
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

  @Patch('owners/:id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a turf owner profile' })
  updateOwner(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminUpdateOwnerDto,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.adminService.updateOwner(id, dto, adminId);
  }

  @Delete('owners/:id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Soft-delete a turf owner (deactivates login + venues)',
  })
  deleteOwner(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminActionReasonDto,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.adminService.deleteOwner(id, dto?.reason ?? '', adminId);
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

  @Post('turfs')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a turf venue on behalf of an owner' })
  createTurf(
    @Body() dto: AdminCreateTurfDto,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.adminService.createTurf(dto, adminId);
  }

  @Patch('turfs/:id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a turf venue (scalars + relations)' })
  updateTurf(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminUpdateTurfDto,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.adminService.updateTurf(id, dto, adminId);
  }

  @Post('turfs/:id/images')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Attach an image URL to a turf gallery' })
  addTurfImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminAddTurfImageDto,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.adminService.addTurfImage(id, dto, adminId);
  }

  @Post('turfs/:id/images/upload')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Upload a turf gallery image file' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file: Express.Multer.File, cb) => {
        if (
          ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)
        ) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              'Only JPEG, PNG and WebP images are allowed',
            ),
            false,
          );
        }
      },
    }),
  )
  uploadTurfImage(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: AdminUploadTurfImageBodyDto,
    @CurrentUser('userId') adminId: string,
  ) {
    if (!file) throw new BadRequestException('No image file uploaded');
    return this.adminService.uploadTurfImage(
      id,
      {
        buffer: file.buffer,
        mimetype: file.mimetype,
        originalname: file.originalname,
        size: file.size,
      },
      body?.caption,
      adminId,
    );
  }

  @Post('turfs/:id/images/:imageId/cover')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Promote a gallery image to cover' })
  setTurfCoverImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.adminService.setTurfCoverImage(id, imageId, adminId);
  }

  @Post('turfs/:id/videos')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Attach a video URL to a turf' })
  addTurfVideo(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminAddTurfVideoDto,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.adminService.addTurfVideo(id, dto, adminId);
  }

  @Post('turfs/:id/videos/upload')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Upload a turf video file (mp4/webm, 100MB)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 100 * 1024 * 1024 },
      fileFilter: (_req, file: Express.Multer.File, cb) => {
        if (['video/mp4', 'video/webm', 'video/quicktime'].includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Only MP4, WebM and QuickTime videos are allowed'), false);
        }
      },
    }),
  )
  uploadTurfVideo(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: AdminUploadTurfImageBodyDto,
    @CurrentUser('userId') adminId: string,
  ) {
    if (!file) throw new BadRequestException('No video file uploaded');
    return this.adminService.uploadTurfVideo(
      id,
      {
        buffer: file.buffer,
        mimetype: file.mimetype,
        originalname: file.originalname,
        size: file.size,
      },
      body?.caption,
      adminId,
    );
  }

  @Delete('turfs/:id/videos/:videoId')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Remove a video from a turf' })
  deleteTurfVideo(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('videoId', ParseUUIDPipe) videoId: string,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.adminService.deleteTurfVideo(id, videoId, adminId);
  }

  @Get('turfs/:id/availability')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get turf hours, blocks and pricing' })
  getTurfAvailability(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.adminService.getTurfAvailability(id, adminId);
  }

  @Post('turfs/:id/availability')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Set turf hours and pricing' })
  setTurfAvailability(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetAvailabilityDto,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.adminService.setTurfAvailability(id, dto, adminId);
  }

  @Put('turfs/:id/availability')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update turf hours and pricing' })
  updateTurfAvailability(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetAvailabilityDto,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.adminService.updateTurfAvailability(id, dto, adminId);
  }

  @Post('turfs/:id/blocks')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Block a slot on a turf' })
  blockTurfSlot(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BlockSlotDto,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.adminService.blockTurfSlot(id, dto, adminId);
  }

  @Delete('turfs/:id/blocks/:slotId')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Unblock a slot on a turf' })
  unblockTurfSlot(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('slotId', ParseUUIDPipe) slotId: string,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.adminService.unblockTurfSlot(id, slotId, adminId);
  }

  // ============================================================================
  // STAFF ASSIGNMENTS
  // ============================================================================

  @Get('staff-assignments')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'List staff/manager turf assignments' })
  listStaff(@Query('ownerId') ownerId?: string) {
    return this.adminService.listStaffAssignments(ownerId);
  }

  @Post('staff-assignments')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Assign a manager/staff user to an owner (optionally one turf)' })
  assignStaff(@Body() dto: AdminAssignStaffDto, @CurrentUser('userId') adminId: string) {
    return this.adminService.assignStaff(dto, adminId);
  }

  @Delete('staff-assignments/:id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Revoke a staff assignment' })
  revokeStaff(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('userId') adminId: string) {
    return this.adminService.revokeStaff(id, adminId);
  }

  @Post('notifications/broadcast')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Broadcast a system notification to users' })
  broadcastNotification(
    @Body() dto: AdminBroadcastDto,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.adminService.broadcastNotification(dto, adminId);
  }

  @Delete('turfs/:id/images/:imageId')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Remove an image from a turf gallery' })
  deleteTurfImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.adminService.deleteTurfImage(id, imageId, adminId);
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

  @Post('bookings')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a booking on behalf of a customer' })
  createBooking(
    @Body() dto: AdminCreateBookingDto,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.adminService.createBooking(dto, adminId);
  }

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

  // ============================================================================
  // REVIEW MODERATION
  // ============================================================================

  @Get('reviews')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all reviews with filters' })
  listReviews(@Query() query: AdminReviewQueryDto) {
    return this.adminService.listReviews(query);
  }

  @Delete('reviews/:id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a review (re-syncs turf rating)' })
  deleteReview(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.adminService.deleteReview(id, adminId);
  }

  // ============================================================================
  // REFUND MANAGEMENT
  // ============================================================================

  @Get('refunds')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all refunds with filters' })
  listRefunds(@Query() query: AdminRefundQueryDto) {
    return this.adminService.listRefunds(query);
  }

  @Patch('refunds/:id/process')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Mark a refund COMPLETED or FAILED' })
  processRefund(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminProcessRefundDto,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.adminService.processRefund(id, dto, adminId);
  }

  // ============================================================================
  // CATALOG (sports + facilities)
  // ============================================================================

  @Get('sports')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all sports with turf usage counts' })
  listSports() {
    return this.adminService.listSports();
  }

  @Post('sports')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a sport' })
  createSport(
    @Body() dto: AdminCreateSportDto,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.adminService.createSport(dto, adminId);
  }

  @Patch('sports/:id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a sport' })
  updateSport(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminUpdateSportDto,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.adminService.updateSport(id, dto, adminId);
  }

  @Delete('sports/:id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Soft-delete a sport' })
  deleteSport(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.adminService.deleteSport(id, adminId);
  }

  @Get('facilities')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all facilities with turf usage counts' })
  listFacilities() {
    return this.adminService.listFacilities();
  }

  @Post('facilities')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a facility' })
  createFacility(
    @Body() dto: AdminCreateFacilityDto,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.adminService.createFacility(dto, adminId);
  }

  @Patch('facilities/:id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a facility' })
  updateFacility(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminUpdateFacilityDto,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.adminService.updateFacility(id, dto, adminId);
  }

  @Delete('facilities/:id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a facility (only when unused)' })
  deleteFacility(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.adminService.deleteFacility(id, adminId);
  }

  // ============================================================================
  // LOCATIONS (country > state > city > area)
  // ============================================================================

  @Get('locations/countries')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all countries' })
  listCountries() {
    return this.adminService.listCountries();
  }

  @Post('locations/countries')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a country' })
  createCountry(@Body() dto: AdminCreateCountryDto, @CurrentUser('userId') adminId: string) {
    return this.adminService.createCountry(dto, adminId);
  }

  @Patch('locations/countries/:id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a country' })
  updateCountry(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminUpdateCountryDto,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.adminService.updateCountry(id, dto, adminId);
  }

  @Delete('locations/countries/:id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a country (only when unused)' })
  deleteCountry(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('userId') adminId: string) {
    return this.adminService.deleteCountry(id, adminId);
  }

  @Get('locations/states')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all states (optional countryId filter)' })
  listStates(@Query('countryId') countryId?: string) {
    return this.adminService.listStates(countryId);
  }

  @Post('locations/states')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a state' })
  createState(@Body() dto: AdminCreateStateDto, @CurrentUser('userId') adminId: string) {
    return this.adminService.createState(dto, adminId);
  }

  @Patch('locations/states/:id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a state' })
  updateState(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminUpdateStateDto,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.adminService.updateState(id, dto, adminId);
  }

  @Delete('locations/states/:id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a state (only when unused)' })
  deleteState(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('userId') adminId: string) {
    return this.adminService.deleteState(id, adminId);
  }

  @Get('locations/cities-admin')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all cities incl. inactive (optional stateId filter)' })
  listCitiesAdmin(@Query('stateId') stateId?: string) {
    return this.adminService.listCities(stateId);
  }

  @Post('locations/cities')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a city' })
  createCity(@Body() dto: AdminCreateCityDto, @CurrentUser('userId') adminId: string) {
    return this.adminService.createCity(dto, adminId);
  }

  @Patch('locations/cities/:id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a city' })
  updateCity(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminUpdateCityDto,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.adminService.updateCity(id, dto, adminId);
  }

  @Delete('locations/cities/:id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a city (only when unused)' })
  deleteCity(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('userId') adminId: string) {
    return this.adminService.deleteCity(id, adminId);
  }

  @Get('locations/areas-admin')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all areas incl. inactive (optional cityId filter)' })
  listAreasAdmin(@Query('cityId') cityId?: string) {
    return this.adminService.listAreas(cityId);
  }

  @Post('locations/areas')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create an area' })
  createArea(@Body() dto: AdminCreateAreaDto, @CurrentUser('userId') adminId: string) {
    return this.adminService.createArea(dto, adminId);
  }

  @Patch('locations/areas/:id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update an area' })
  updateArea(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminUpdateAreaDto,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.adminService.updateArea(id, dto, adminId);
  }

  @Delete('locations/areas/:id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete an area (only when unused)' })
  deleteArea(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('userId') adminId: string) {
    return this.adminService.deleteArea(id, adminId);
  }

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
