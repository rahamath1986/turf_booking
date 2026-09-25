import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';

@ApiTags('Payment Webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('payment')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Receive and process payment gateway webhook notifications',
    description:
      'Validates webhook signature, handles duplicate events idempotently, and confirms bookings asynchronously upon gateway notification.',
  })
  @ApiResponse({ status: 200, description: 'Webhook received and processed' })
  @ApiResponse({ status: 400, description: 'Invalid webhook signature' })
  handlePaymentWebhook(
    @Req() req: any,
    @Headers() headers: Record<string, string>,
    @Body() body: any,
  ) {
    const rawBody = req.rawBody
      ? req.rawBody.toString('utf8')
      : JSON.stringify(body);
    return this.paymentsService.handleWebhook(rawBody, headers, body);
  }
}
