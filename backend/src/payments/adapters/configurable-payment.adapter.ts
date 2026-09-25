import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import {
  CreateOrderParams,
  CreateOrderResult,
  PaymentProvider,
  VerifyPaymentParams,
  VerifyWebhookParams,
  WebhookEventPayload,
} from '../interfaces/payment-provider.interface';

@Injectable()
export class ConfigurablePaymentAdapter implements PaymentProvider {
  private readonly logger = new Logger(ConfigurablePaymentAdapter.name);

  readonly providerName: string;
  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly webhookSecret: string;

  constructor(private readonly configService: ConfigService) {
    this.providerName = this.configService
      .get<string>('payment.provider', 'mock')
      .toUpperCase();
    this.keyId = this.configService.get<string>(
      'payment.keyId',
      'mock_key_id_dev',
    );
    this.keySecret = this.configService.get<string>(
      'payment.keySecret',
      'mock_key_secret_dev',
    );
    this.webhookSecret = this.configService.get<string>(
      'payment.webhookSecret',
      'mock_webhook_secret_dev',
    );

    this.logger.log(
      `Initialized ConfigurablePaymentAdapter with provider: ${this.providerName}`,
    );
  }

  createOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
    const timestamp = Date.now();
    const randomSuffix = crypto.randomBytes(4).toString('hex');
    const orderId = `order_${this.providerName.toLowerCase()}_${timestamp}_${randomSuffix}`;

    return Promise.resolve({
      orderId,
      amount: params.amount,
      currency: params.currency,
      provider: this.providerName,
      keyId: this.keyId,
    });
  }

  verifyPayment(params: VerifyPaymentParams): Promise<boolean> {
    const { orderId, transactionId, signature } = params;

    // Standard HMAC SHA256 signature verification used by Razorpay / Mock Gateway:
    // signature == hmac_sha256(orderId + "|" + transactionId, keySecret)
    const expectedSignature = crypto
      .createHmac('sha256', this.keySecret)
      .update(`${orderId}|${transactionId}`)
      .digest('hex');

    try {
      const sigBuf = Buffer.from(signature, 'utf8');
      const expectedBuf = Buffer.from(expectedSignature, 'utf8');

      if (sigBuf.length !== expectedBuf.length) {
        this.logger.warn(
          `Server-side payment signature length mismatch for order ${orderId}`,
        );
        return Promise.resolve(false);
      }

      const isValid = crypto.timingSafeEqual(sigBuf, expectedBuf);
      if (!isValid) {
        this.logger.warn(
          `Server-side payment signature mismatch for order ${orderId}`,
        );
      }
      return Promise.resolve(isValid);
    } catch {
      return Promise.resolve(false);
    }
  }

  verifyWebhookSignature(params: VerifyWebhookParams): boolean {
    const { rawBody, signature, secret } = params;
    const secretToUse = secret || this.webhookSecret;

    if (!signature || !secretToUse) {
      return false;
    }

    try {
      const expectedSignature = crypto
        .createHmac('sha256', secretToUse)
        .update(rawBody)
        .digest('hex');

      const sigBuf = Buffer.from(signature, 'utf8');
      const expectedBuf = Buffer.from(expectedSignature, 'utf8');

      if (sigBuf.length !== expectedBuf.length) {
        return false;
      }

      return crypto.timingSafeEqual(sigBuf, expectedBuf);
    } catch {
      return false;
    }
  }

  parseWebhookEvent(body: any, headers: any): WebhookEventPayload {
    // Extracts event details from gateway webhook payload
    const eventId =
      body.event_id ||
      body.id ||
      headers['x-razorpay-event-id'] ||
      `evt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const rawEvent = body.event || body.type || 'payment.captured';
    let eventType: WebhookEventPayload['eventType'] = 'other';

    if (
      rawEvent.includes('captured') ||
      rawEvent.includes('paid') ||
      rawEvent.includes('success')
    ) {
      eventType = 'payment.captured';
    } else if (rawEvent.includes('failed')) {
      eventType = 'payment.failed';
    } else if (rawEvent.includes('refund')) {
      eventType = 'refund.processed';
    }

    const orderId =
      body.payload?.payment?.entity?.order_id ||
      body.orderId ||
      body.order_id ||
      body.data?.object?.metadata?.order_id;

    const transactionId =
      body.payload?.payment?.entity?.id ||
      body.transactionId ||
      body.payment_id ||
      body.data?.object?.id;

    const amount = body.payload?.payment?.entity?.amount || body.amount;

    const failureReason =
      body.payload?.payment?.entity?.error_description ||
      body.error?.description ||
      body.failureReason;

    return {
      eventId,
      eventType,
      orderId,
      transactionId,
      amount: amount ? Number(amount) / 100 : undefined,
      failureReason,
      raw: body,
    };
  }

  processRefund(
    params: import('../interfaces/payment-provider.interface').ProcessRefundParams,
  ): Promise<
    import('../interfaces/payment-provider.interface').ProcessRefundResult
  > {
    const refundSuffix = crypto.randomBytes(4).toString('hex');
    const gatewayRefundId = `rfnd_${this.providerName.toLowerCase()}_${Date.now()}_${refundSuffix}`;

    this.logger.log(
      `[${this.providerName}] Processed refund of ₹${params.amount} for transaction ${params.transactionId}. Refund ID: ${gatewayRefundId}`,
    );

    return Promise.resolve({
      gatewayRefundId,
      status: 'COMPLETED',
      amount: params.amount,
    });
  }

  /**
   * Helper utility for testing or client SDK integration:
   * Generates a valid HMAC SHA256 payment signature for order + transaction.
   */
  generateTestSignature(orderId: string, transactionId: string): string {
    return crypto
      .createHmac('sha256', this.keySecret)
      .update(`${orderId}|${transactionId}`)
      .digest('hex');
  }

  /**
   * Helper utility for testing:
   * Generates a valid HMAC SHA256 webhook signature for a raw body payload.
   */
  generateTestWebhookSignature(rawBody: string): string {
    return crypto
      .createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex');
  }
}
