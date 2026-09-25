import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { RescheduleBookingDto } from './dto/reschedule-booking.dto';
import { BookingQueryDto } from './dto/booking-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

import { RefundsService } from '../refunds/refunds.service';

@ApiTags('Bookings')
@Controller('bookings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class BookingsController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly refundsService: RefundsService,
  ) {}

  @Post()
  @ApiOperation({
    summary:
      'Confirm a booking atomically from hold or direct slot reservation',
    description:
      'Creates a confirmed booking with PostgreSQL transactions and advisory locks. Enforces unique slot constraints to guarantee zero double bookings.',
  })
  @ApiResponse({ status: 201, description: 'Booking confirmed successfully' })
  @ApiResponse({
    status: 409,
    description: 'Conflict: Slot already booked or held',
  })
  @ApiResponse({ status: 410, description: 'Gone: Slot hold has expired' })
  createBooking(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateBookingDto,
  ) {
    return this.bookingsService.createBooking(userId, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List user bookings with pagination and status filters',
    description:
      'Returns paginated list of bookings. Customers see their own bookings; turf owners see bookings for their venues.',
  })
  @ApiResponse({ status: 200, description: 'Paginated bookings' })
  findAll(
    @CurrentUser('userId') userId: string,
    @CurrentUser('roles') userRoles: string[],
    @Query() query: BookingQueryDto,
  ) {
    return this.bookingsService.findAll(userId, userRoles, query);
  }

  @Get(':id/status')
  @ApiOperation({
    summary: 'Lightweight booking status inquiry',
    description:
      'Returns real-time status of a booking for polling or quick checks.',
  })
  @ApiResponse({ status: 200, description: 'Booking status' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  getStatus(
    @CurrentUser('userId') userId: string,
    @CurrentUser('roles') userRoles: string[],
    @Param('id') id: string,
  ) {
    return this.bookingsService.getBookingStatus(userId, userRoles, id);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get complete booking details and auditable status history',
    description:
      'Retrieves full booking breakdown including venue details, slot times, and chronological status transitions.',
  })
  @ApiResponse({ status: 200, description: 'Full booking details' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  findOne(
    @CurrentUser('userId') userId: string,
    @CurrentUser('roles') userRoles: string[],
    @Param('id') id: string,
  ) {
    return this.bookingsService.findOne(userId, userRoles, id);
  }

  @Get(':id/cancellation-fee')
  @ApiOperation({
    summary: 'Calculate cancellation fee and refund eligibility for a booking',
    description:
      'Computes the cancellation fee, refund percentage, and net refundable amount server-side based on the turf cancellation policy and remaining time until game start.',
  })
  @ApiResponse({ status: 200, description: 'Cancellation fee breakdown' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  getCancellationFee(
    @CurrentUser('userId') userId: string,
    @CurrentUser('roles') userRoles: string[],
    @Param('id') id: string,
  ) {
    return this.refundsService.calculateCancellationFee(userId, userRoles, id);
  }

  @Get(':id/refund-preview')
  @ApiOperation({
    summary: 'Preview refund breakdown before cancellation',
    description:
      'Returns a detailed preview of all financial values, fee deductions, and estimated refund status if the user cancels right now.',
  })
  @ApiResponse({ status: 200, description: 'Refund preview details' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  getRefundPreview(
    @CurrentUser('userId') userId: string,
    @CurrentUser('roles') userRoles: string[],
    @Param('id') id: string,
  ) {
    return this.refundsService.getRefundPreview(userId, userRoles, id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel an active booking with server-side refund calculation',
    description:
      'Cancels the booking, frees the slot in the database, automatically issues refund via payment adapter if paid, and appends to status history.',
  })
  @ApiResponse({ status: 200, description: 'Booking cancelled successfully' })
  @ApiResponse({
    status: 400,
    description: 'Cannot cancel completed or already cancelled booking',
  })
  cancelBooking(
    @CurrentUser('userId') userId: string,
    @CurrentUser('roles') userRoles: string[],
    @Param('id') id: string,
    @Body() dto: CancelBookingDto,
  ) {
    return this.refundsService.cancelBookingWithRefund(
      userId,
      userRoles,
      id,
      dto,
    );
  }

  @Post(':id/reschedule')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reschedule an active booking to a new timeslot',
    description:
      'Atomically locks the new target slot, frees the old slot, and updates the booking schedule.',
  })
  @ApiResponse({ status: 200, description: 'Booking rescheduled successfully' })
  @ApiResponse({
    status: 409,
    description: 'Conflict: New slot is already booked or held',
  })
  rescheduleBooking(
    @CurrentUser('userId') userId: string,
    @CurrentUser('roles') userRoles: string[],
    @Param('id') id: string,
    @Body() dto: RescheduleBookingDto,
  ) {
    return this.bookingsService.rescheduleBooking(userId, userRoles, id, dto);
  }
}
