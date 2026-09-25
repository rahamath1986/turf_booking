export interface CreateOrderParams {
  amount: number; // In currency units (e.g. INR)
  currency: string;
  orderReference: string; // Internal payment reference (e.g. paymentNumber)
  customer?: {
    id: string;
    email: string;
    fullName?: string;
    phone?: string;
  };
  notes?: Record<string, any>;
}

export interface CreateOrderResult {
  orderId: string;
  amount: number;
  currency: string;
  provider: string;
  keyId: string;
}

export interface VerifyPaymentParams {
  orderId: string;
  transactionId: string;
  signature: string;
}

export interface VerifyWebhookParams {
  rawBody: string;
  signature: string;
  secret: string;
}

export interface WebhookEventPayload {
  eventId: string;
  eventType:
    'payment.captured' | 'payment.failed' | 'refund.processed' | 'other';
  orderId?: string;
  transactionId?: string;
  amount?: number;
  failureReason?: string;
  raw: any;
}

export interface ProcessRefundParams {
  transactionId: string;
  orderId?: string;
  amount: number;
  currency?: string;
  reason?: string;
  metadata?: Record<string, any>;
}

export interface ProcessRefundResult {
  gatewayRefundId: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  amount: number;
  failureReason?: string;
}

export interface PaymentProvider {
  readonly providerName: string;
  createOrder(params: CreateOrderParams): Promise<CreateOrderResult>;
  verifyPayment(params: VerifyPaymentParams): Promise<boolean>;
  verifyWebhookSignature(params: VerifyWebhookParams): boolean;
  parseWebhookEvent(body: any, headers: any): WebhookEventPayload;
  processRefund(params: ProcessRefundParams): Promise<ProcessRefundResult>;
}
