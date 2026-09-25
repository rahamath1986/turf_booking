import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
import { CreateHoldDto } from './dto/create-hold.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Booking Holds')
@Controller('booking/holds')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class BookingHoldsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @ApiOperation({
    summary: 'Hold a timeslot temporarily before checkout (10-minute TTL)',
    description:
      'Acquires transactional lock on the slot and creates a temporary hold. Prevents racing customers from double booking during checkout.',
  })
  @ApiResponse({ status: 201, description: 'Slot held successfully' })
  @ApiResponse({
    status: 409,
    description: 'Conflict: Slot already held or booked',
  })
  createHold(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateHoldDto,
  ) {
    return this.bookingsService.createHold(userId, dto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get details and TTL status of a temporary slot hold',
    description:
      'Retrieves the hold record. Automatically flags as EXPIRED if the 10-minute window has elapsed.',
  })
  @ApiResponse({ status: 200, description: 'Hold details and status' })
  @ApiResponse({ status: 404, description: 'Hold not found' })
  getHold(
    @CurrentUser('userId') userId: string,
    @CurrentUser('roles') userRoles: string[],
    @Param('id') id: string,
  ) {
    return this.bookingsService.getHoldById(userId, userRoles, id);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Release a temporary hold voluntarily',
    description:
      'Cancels the active hold and immediately makes the slot available for other customers.',
  })
  @ApiResponse({ status: 200, description: 'Hold released successfully' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden: Cannot release another user’s hold',
  })
  @ApiResponse({ status: 404, description: 'Hold not found' })
  releaseHold(
    @CurrentUser('userId') userId: string,
    @CurrentUser('roles') userRoles: string[],
    @Param('id') id: string,
  ) {
    return this.bookingsService.releaseHold(userId, userRoles, id);
  }
}
