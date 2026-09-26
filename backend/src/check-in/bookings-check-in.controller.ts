import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CheckInService } from './check-in.service';
import { CheckInNotesDto } from './dto/check-in.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Booking QR & Check-In')
@Controller('bookings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class BookingsCheckInController {
  constructor(private readonly checkInService: CheckInService) {}

  @Get(':id/qr')
  @ApiOperation({
    summary: 'Generate secure QR code & token for booking check-in',
    description:
      'Returns a cryptographically signed, tamper-proof QR token and base64 PNG image for gate scanning.',
  })
  @ApiResponse({ status: 200, description: 'QR check-in token and image URL' })
  @ApiResponse({ status: 403, description: 'Forbidden: Not your booking' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  getBookingQr(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('roles') userRoles: string[],
  ) {
    return this.checkInService.getBookingQr(id, userId, userRoles);
  }

  @Post(':id/check-in')
  @ApiOperation({
    summary: 'Check in customer at venue gate',
    description:
      'Performs check-in with duplicate prevention, date/time window verification, and audit logging.',
  })
  @ApiResponse({ status: 201, description: 'Check-in successful' })
  @ApiResponse({
    status: 400,
    description: 'Already checked in, expired, or invalid timing',
  })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  checkIn(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('roles') userRoles: string[],
    @Body() dto: CheckInNotesDto,
  ) {
    return this.checkInService.checkIn(id, userId, userRoles, dto.notes, {
      latitude: dto.latitude,
      longitude: dto.longitude,
      location: dto.location,
      accuracy: dto.accuracy,
    });
  }

  @Post(':id/check-out')
  @ApiOperation({
    summary: 'Check out customer and complete match session',
    description:
      'Marks the booking as checked out and transitions state to COMPLETED with audit recording.',
  })
  @ApiResponse({ status: 201, description: 'Check-out completed successfully' })
  @ApiResponse({
    status: 400,
    description: 'Not checked in or already checked out',
  })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  checkOut(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('roles') userRoles: string[],
    @Body() dto: CheckInNotesDto,
  ) {
    return this.checkInService.checkOut(id, userId, userRoles, dto.notes, {
      latitude: dto.latitude,
      longitude: dto.longitude,
      location: dto.location,
      accuracy: dto.accuracy,
    });
  }

  @Get(':id/check-in-status')
  @ApiOperation({
    summary: 'Get check-in/out status and audit trail',
    description:
      'Inquires real-time check-in status, gate timestamps, gatekeeper user, and audit logs.',
  })
  @ApiResponse({ status: 200, description: 'Check-in status and audit logs' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  getCheckInStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('roles') userRoles: string[],
  ) {
    return this.checkInService.getCheckInStatus(id, userId, userRoles);
  }
}
