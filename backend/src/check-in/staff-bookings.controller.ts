import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CheckInService } from './check-in.service';
import { ScanQrDto } from './dto/scan-qr.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';

@ApiTags('Staff Gate Scanning')
@Controller('staff/bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.STAFF, Role.TURF_OWNER, Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN)
@ApiBearerAuth('JWT-auth')
export class StaffBookingsController {
  constructor(private readonly checkInService: CheckInService) {}

  @Post('scan')
  @ApiOperation({
    summary: 'Staff scans customer QR code at venue gate',
    description:
      'Validates QR token signature, expiration, venue assignment, and date/time window. Audits scan event.',
  })
  @ApiResponse({ status: 201, description: 'QR scan verified successfully' })
  @ApiResponse({
    status: 400,
    description: 'Invalid, forged, or expired QR token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden: Staff unauthorized for venue',
  })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  scanQr(
    @CurrentUser('userId') staffUserId: string,
    @CurrentUser('roles') staffRoles: string[],
    @Body() dto: ScanQrDto,
  ) {
    return this.checkInService.scanBookingQr(
      staffUserId,
      staffRoles,
      dto.qrToken,
      dto.turfId,
    );
  }
}
