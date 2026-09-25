import {
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
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NotificationQueryDto } from './dto/notification-query.dto';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get paginated notifications for current user',
    description:
      'Fetches notifications for the authenticated user, with optional filters for read status or notification type.',
  })
  @ApiResponse({ status: 200, description: 'Paginated user notifications' })
  getUserNotifications(
    @CurrentUser('userId') userId: string,
    @Query() query: NotificationQueryDto,
  ) {
    return this.notificationsService.getUserNotifications(userId, query);
  }

  @Get('unread')
  @ApiOperation({
    summary: 'Get unread notifications and unread badge count',
    description:
      'Fast endpoint for displaying unread notification count badge and unread inbox items.',
  })
  @ApiResponse({ status: 200, description: 'Unread notifications and counter' })
  getUnreadNotifications(@CurrentUser('userId') userId: string) {
    return this.notificationsService.getUnreadNotifications(userId);
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark a specific notification as read',
    description: 'Marks the notification as read and sets read timestamp.',
  })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  markAsRead(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.notificationsService.markAsRead(userId, id);
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark all unread notifications as read',
    description:
      'Marks all unread notifications for the authenticated user as read in bulk.',
  })
  @ApiResponse({ status: 200, description: 'All notifications marked as read' })
  markAllAsRead(@CurrentUser('userId') userId: string) {
    return this.notificationsService.markAllAsRead(userId);
  }
}
