import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
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
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RegisterDeviceDto } from './dto/register-device.dto';

@ApiTags('Devices')
@Controller('devices')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class DevicesController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register or refresh an FCM device token for push notifications',
    description:
      'Stores the FCM registration token linked to the authenticated user and activates it for push notifications.',
  })
  @ApiResponse({ status: 201, description: 'Device registered successfully' })
  registerDevice(
    @CurrentUser('userId') userId: string,
    @Body() dto: RegisterDeviceDto,
  ) {
    return this.notificationsService.registerDevice(userId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Unregister a device token',
    description:
      'Removes the device token upon logout or app uninstallation to stop receiving push notifications.',
  })
  @ApiResponse({ status: 200, description: 'Device unregistered successfully' })
  @ApiResponse({ status: 404, description: 'Device not found' })
  unregisterDevice(
    @CurrentUser('userId') userId: string,
    @CurrentUser('roles') userRoles: string[],
    @Param('id') id: string,
  ) {
    return this.notificationsService.unregisterDevice(userId, userRoles, id);
  }
}
