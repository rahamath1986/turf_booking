import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { WebhooksController } from './webhooks.controller';
import { ConfigurablePaymentAdapter } from './adapters/configurable-payment.adapter';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [PaymentsController, WebhooksController],
  providers: [PaymentsService, ConfigurablePaymentAdapter],
  exports: [PaymentsService, ConfigurablePaymentAdapter],
})
export class PaymentsModule {}
