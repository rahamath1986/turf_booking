import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { OwnersService } from './owners.service';
import { OwnerBookingQueryDto } from './dto/owner-booking-query.dto';
import { CreateWalkInBookingDto } from './dto/create-walk-in-booking.dto';
import { OwnerCancelBookingDto } from './dto/owner-cancel-booking.dto';
import { OwnerRescheduleBookingDto } from './dto/owner-reschedule-booking.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';

@ApiTags('Owner Bookings Management')
@Controller('owner/bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TURF_OWNER, Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN)
@ApiBearerAuth('JWT-auth')
export class OwnerBookingsController {
  constructor(private readonly ownersService: OwnersService) {}

  @Get()
  @ApiOperation({
    summary: 'List bookings for owner venues',
    description:
      'Returns paginated bookings across all turfs owned by this user, with search and status filtering.',
  })
  @ApiResponse({ status: 200, description: 'Paginated owner bookings' })
  getOwnerBookings(
    @CurrentUser('userId') userId: string,
    @CurrentUser('roles') userRoles: string[],
    @Query() query: OwnerBookingQueryDto,
  ) {
    return this.ownersService.getOwnerBookings(userId, userRoles, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get full booking details',
    description:
      'Retrieves complete booking information including customer, payment method, audit status history, and turf information.',
  })
  @ApiResponse({ status: 200, description: 'Booking detailed record' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden: You do not own this venue',
  })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  getOwnerBookingById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('roles') userRoles: string[],
  ) {
    return this.ownersService.getOwnerBookingById(id, userId, userRoles);
  }

  @Post('walk-in')
  @ApiOperation({
    summary: 'Register walk-in / offline booking',
    description:
      'Allows turf owner or staff to create a confirmed walk-in booking on the spot with cash/offline payment collection.',
  })
  @ApiResponse({
    status: 201,
    description: 'Walk-in booking created successfully',
  })
  @ApiResponse({
    status: 409,
    description: 'Slot is already booked or blocked',
  })
  createWalkInBooking(
    @CurrentUser('userId') userId: string,
    @CurrentUser('roles') userRoles: string[],
    @Body() dto: CreateWalkInBookingDto,
  ) {
    return this.ownersService.createWalkInBooking(userId, userRoles, dto);
  }

  @Post(':id/cancel')
  @ApiOperation({
    summary: 'Owner cancels booking',
    description:
      'Turf owner cancels a match booking (e.g. maintenance or bad weather), immediately freeing the slot.',
  })
  @ApiResponse({ status: 200, description: 'Booking cancelled by owner' })
  @ApiResponse({
    status: 400,
    description: 'Booking already cancelled or completed',
  })
  cancelOwnerBooking(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('roles') userRoles: string[],
    @Body() dto: OwnerCancelBookingDto,
  ) {
    return this.ownersService.cancelOwnerBooking(id, userId, userRoles, dto);
  }

  @Post(':id/reschedule')
  @ApiOperation({
    summary: 'Owner reschedules booking',
    description:
      'Turf owner moves a booking to a new date and time slot with conflict checks.',
  })
  @ApiResponse({ status: 200, description: 'Booking rescheduled successfully' })
  @ApiResponse({
    status: 409,
    description: 'Target slot is already booked or blocked',
  })
  rescheduleOwnerBooking(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('roles') userRoles: string[],
    @Body() dto: OwnerRescheduleBookingDto,
  ) {
    return this.ownersService.rescheduleOwnerBooking(
      id,
      userId,
      userRoles,
      dto,
    );
  }
}
