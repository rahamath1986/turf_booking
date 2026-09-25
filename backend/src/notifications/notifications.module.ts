import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { DevicesController } from './devices.controller';
import { FcmNotificationAdapter } from './adapters/fcm-notification.adapter';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [NotificationsController, DevicesController],
  providers: [NotificationsService, FcmNotificationAdapter],
  exports: [NotificationsService, FcmNotificationAdapter],
})
export class NotificationsModule {}
