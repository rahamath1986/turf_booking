import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AvailabilityService } from './availability.service';
import { SetAvailabilityDto } from './dto/set-operating-hours.dto';
import { BlockSlotDto } from './dto/block-slot.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';

@ApiTags('Turf Owner Availability & Pricing')
@Controller('owner/turfs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TURF_OWNER, Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN)
@ApiBearerAuth('JWT-auth')
export class OwnerAvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Get(':id/availability')
  @ApiOperation({
    summary:
      'Get owner operating hours, upcoming blocked slots, and pricing rules',
    description:
      'Returns operating schedule and active blocked slots. Strictly enforces turf ownership boundary.',
  })
  @ApiResponse({ status: 200, description: 'Turf availability configuration' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden: Cannot access another owner’s turf',
  })
  @ApiResponse({ status: 404, description: 'Turf not found' })
  getOwnerAvailability(
    @CurrentUser('userId') userId: string,
    @CurrentUser('roles') userRoles: string[],
    @Param('id') id: string,
  ) {
    return this.availabilityService.getOwnerAvailability(userId, userRoles, id);
  }

  @Post(':id/availability')
  @ApiOperation({
    summary: 'Configure turf operating schedule and pricing rules',
    description:
      'Creates or sets operating hours and pricing matrix. Enforces ownership authorization.',
  })
  @ApiResponse({
    status: 201,
    description: 'Availability and pricing configured successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden: Cannot manage another owner’s turf',
  })
  @ApiResponse({ status: 404, description: 'Turf not found' })
  setOwnerAvailability(
    @CurrentUser('userId') userId: string,
    @CurrentUser('roles') userRoles: string[],
    @Param('id') id: string,
    @Body() dto: SetAvailabilityDto,
  ) {
    return this.availabilityService.setOwnerAvailability(
      userId,
      userRoles,
      id,
      dto,
    );
  }

  @Put(':id/availability')
  @ApiOperation({
    summary: 'Update turf operating schedule and pricing rules',
    description:
      'Updates operating hours and pricing matrix for the owned turf.',
  })
  @ApiResponse({
    status: 200,
    description: 'Availability updated successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden: Cannot manage another owner’s turf',
  })
  @ApiResponse({ status: 404, description: 'Turf not found' })
  updateOwnerAvailability(
    @CurrentUser('userId') userId: string,
    @CurrentUser('roles') userRoles: string[],
    @Param('id') id: string,
    @Body() dto: SetAvailabilityDto,
  ) {
    return this.availabilityService.updateOwnerAvailability(
      userId,
      userRoles,
      id,
      dto,
    );
  }

  @Post(':id/block-slot')
  @ApiOperation({
    summary: 'Block a timeslot for maintenance, tournament, or owner hold',
    description:
      'Prevents customer bookings for the specified date and time interval.',
  })
  @ApiResponse({ status: 201, description: 'Timeslot blocked successfully' })
  @ApiResponse({
    status: 400,
    description: 'Invalid date or startTime >= endTime',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden: Cannot manage another owner’s turf',
  })
  @ApiResponse({ status: 404, description: 'Turf not found' })
  blockSlot(
    @CurrentUser('userId') userId: string,
    @CurrentUser('roles') userRoles: string[],
    @Param('id') id: string,
    @Body() dto: BlockSlotDto,
  ) {
    return this.availabilityService.blockSlot(userId, userRoles, id, dto);
  }

  @Delete(':id/block-slot/:slotId')
  @ApiOperation({
    summary: 'Unblock a previously blocked timeslot',
    description:
      'Removes the block on the timeslot, restoring it to available for customer booking.',
  })
  @ApiResponse({ status: 200, description: 'Timeslot unblocked successfully' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden: Cannot manage another owner’s turf',
  })
  @ApiResponse({ status: 404, description: 'Blocked slot not found' })
  unblockSlot(
    @CurrentUser('userId') userId: string,
    @CurrentUser('roles') userRoles: string[],
    @Param('id') id: string,
    @Param('slotId') slotId: string,
  ) {
    return this.availabilityService.unblockSlot(userId, userRoles, id, slotId);
  }
}
