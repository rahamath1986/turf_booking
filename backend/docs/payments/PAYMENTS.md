# Payment Abstraction & Webhook Subsystem

## Overview

The Payment Abstraction subsystem provides a vendor-agnostic architecture for initiating orders, conducting mandatory server-side verification, executing transactional booking confirmations, handling webhook notifications, and maintaining auditable state histories.

The application is **never tightly coupled** to a specific payment provider (e.g., Razorpay, Stripe, Cashfree, or Mock Gateway). All payment gateways implement the `PaymentProvider` interface and are plugged in via configurable adapters governed by environment variables.

---

## Security Model: Server-Side Cryptographic Verification

> [!IMPORTANT]
> **A booking must NEVER be confirmed solely from a Flutter client callback.**
>
> Mobile client callbacks can be spoofed, manipulated, or simulated by malicious actors. Therefore:
> 1. Mobile clients (Flutter) only receive raw credentials (`order_id`, `payment_id`, `signature`) from the gateway SDK.
> 2. The mobile client relays these parameters to `POST /api/v1/payments/verify`.
> 3. The server computes the HMAC-SHA256 signature using the server-side API secret (`PAYMENT_KEY_SECRET`) and executes timing-safe comparison (`crypto.timingSafeEqual`).
> 4. Only if the cryptographic signature matches does a PostgreSQL transaction transition the Payment to `SUCCESS` and the Booking to `CONFIRMED`.
> 5. Asynchronous server-to-server webhooks (`POST /api/v1/webhooks/payment`) serve as a resilient secondary confirmation path with webhook signature verification.

---

## Architectural Components

```mermaid
flowchart TD
    subgraph Client ["Client Layer (Flutter App)"]
        A[Customer Books Slot] --> B[POST /api/v1/booking/holds]
        B --> C[POST /api/v1/payments/create-order]
        C --> D[Open Gateway Checkout Modal]
        D --> E[Receive Gateway Callback (orderId, txId, sig)]
        E --> F[POST /api/v1/payments/verify]
    end

    subgraph Server ["Backend API"]
        F --> G[ConfigurablePaymentAdapter.verifyPayment]
        G -->|Invalid Signature| H[Record FAILED & Throw 400 Bad Request]
        G -->|Valid Signature| I[Prisma Transaction: Payment SUCCESS + Booking CONFIRMED]
    end

    subgraph WebhookPath ["Asynchronous Webhook Path"]
        GW[Payment Gateway Server] -->|Webhook POST /api/v1/webhooks/payment| W[WebhooksController]
        W --> V[ConfigurablePaymentAdapter.verifyWebhookSignature]
        V -->|Invalid Signature| WFail[Throw 400 Bad Request]
        V -->|Valid| WCheck{Already Processed?}
        WCheck -->|Yes| WSkip[Return 200 OK - duplicate: true]
        WCheck -->|No| WTx[Prisma Transaction: Payment SUCCESS + Booking CONFIRMED]
    end
```

---

## Payment Provider Interface (`PaymentProvider`)

The core abstraction defined in [`src/payments/interfaces/payment-provider.interface.ts`](file:///Users/rahamathalikhan/Documents/turf_booking/backend/src/payments/interfaces/payment-provider.interface.ts):

```typescript
export interface CreateOrderParams {
  amount: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}

export interface CreateOrderResult {
  orderId: string;
  amount: number;
  currency: string;
  provider: string;
  keyId: string;
  metadata?: Record<string, any>;
}

export interface VerifyPaymentParams {
  orderId: string;
  transactionId: string;
  signature: string;
}

export interface VerifyWebhookParams {
  rawBody: string | Buffer;
  signature: string;
  secret?: string;
}

export interface WebhookEventPayload {
  eventId: string;
  eventType: 'payment.captured' | 'payment.failed' | 'refund.processed' | 'other';
  orderId: string;
  transactionId?: string;
  amount?: number;
  currency?: string;
  payload: Record<string, any>;
}

export interface PaymentProvider {
  createOrder(params: CreateOrderParams): Promise<CreateOrderResult>;
  verifyPayment(params: VerifyPaymentParams): Promise<boolean>;
  verifyWebhookSignature(params: VerifyWebhookParams): boolean;
  parseWebhookEvent(body: any, headers: Record<string, any>): WebhookEventPayload;
}
```

---

## Configurable Adapter

Implemented in [`src/payments/adapters/configurable-payment.adapter.ts`](file:///Users/rahamathalikhan/Documents/turf_booking/backend/src/payments/adapters/configurable-payment.adapter.ts).

### Environment Configuration

The adapter dynamically reads configuration from the environment via `ConfigService`:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PAYMENT_PROVIDER` | `MOCK` | Gateway identifier (`RAZORPAY`, `STRIPE`, `MOCK`, etc.) |
| `PAYMENT_KEY_ID` | `rzp_test_sample_key_id` | Gateway public key id |
| `PAYMENT_KEY_SECRET` | `sample_mock_secret_key_12345` | Server-side cryptographic secret |
| `PAYMENT_WEBHOOK_SECRET` | `sample_mock_webhook_secret_67890` | Webhook verification signing secret |

### Signature Verification Algorithm
```typescript
const expectedSignature = crypto
  .createHmac('sha256', this.keySecret)
  .update(`${orderId}|${transactionId}`)
  .digest('hex');

const sigBuf = Buffer.from(signature, 'utf8');
const expectedBuf = Buffer.from(expectedSignature, 'utf8');

if (sigBuf.length !== expectedBuf.length) {
  return false;
}

return crypto.timingSafeEqual(sigBuf, expectedBuf);
```

---

## Database Models

The PostgreSQL database schema includes:

```prisma
enum PaymentStatus {
  PENDING
  SUCCESS
  FAILED
  REFUNDED
}

model Payment {
  id              String                 @id @default(uuid()) @db.Uuid
  bookingId       String?                @unique @map("booking_id") @db.Uuid
  slotHoldId      String?                @map("slot_hold_id") @db.Uuid
  userId          String                 @map("user_id") @db.Uuid
  provider        String                 @db.VarChar(50)
  orderId         String                 @unique @map("order_id") @db.VarChar(100)
  transactionId   String?                @unique @map("transaction_id") @db.VarChar(100)
  amount          Decimal                @db.Decimal(10, 2)
  currency        String                 @default("INR") @db.VarChar(10)
  status          PaymentStatus          @default(PENDING)
  signature       String?                @db.VarChar(255)
  failureReason   String?                @map("failure_reason") @db.Text
  createdAt       DateTime               @default(now()) @map("created_at")
  updatedAt       DateTime               @updatedAt @map("updated_at")

  booking         Booking?               @relation(...)
  slotHold        SlotHold?              @relation(...)
  user            User                   @relation(...)
  statusHistory   PaymentStatusHistory[]

  @@map("payments")
}

model PaymentStatusHistory {
  id         String        @id @default(uuid()) @db.Uuid
  paymentId  String        @map("payment_id") @db.Uuid
  fromStatus PaymentStatus @map("from_status")
  toStatus   PaymentStatus @map("to_status")
  reason     String?       @db.VarChar(255)
  createdAt  DateTime      @default(now()) @map("created_at")

  payment    Payment       @relation(...)

  @@map("payment_status_history")
}

model WebhookEvent {
  id          String   @id @default(uuid()) @db.Uuid
  provider    String   @db.VarChar(50)
  eventId     String   @unique @map("event_id") @db.VarChar(100)
  eventType   String   @map("event_type") @db.VarChar(50)
  orderId     String?  @map("order_id") @db.VarChar(100)
  processedAt DateTime @default(now()) @map("processed_at")
  payload     Json

  @@map("webhook_events")
}
```

---

## API Specifications

### 1. Create Payment Order
`POST /api/v1/payments/create-order`  
**Authorization**: Bearer JWT (Customer)

#### Request Body
```json
{
  "holdId": "349fd043-41bb-4fd6-91e7-f1311fcfae08"
}
```
*Note: If an active booking already exists, `bookingId` can be supplied instead of `holdId`.*

#### Response (201 Created)
```json
{
  "success": true,
  "data": {
    "paymentId": "7e3ca0a8-b633-4f9e-a89e-26f6323cfcf5",
    "orderId": "order_mock_1758778546123_a9b1c2d3",
    "amount": 1400,
    "currency": "INR",
    "provider": "MOCK",
    "keyId": "rzp_test_sample_key_id",
    "status": "PENDING"
  }
}
```

---

### 2. Verify Payment (Server-Side)
`POST /api/v1/payments/verify`  
**Authorization**: Bearer JWT (Customer)

#### Request Body
```json
{
  "orderId": "order_mock_1758778546123_a9b1c2d3",
  "transactionId": "pay_tx_987654321",
  "signature": "e5c703b41d25514f77c3a07ecad31c77f0a8d672722137be8a9b3695287f3b5e"
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "verified": true,
    "message": "Payment verified and booking confirmed successfully",
    "payment": {
      "id": "7e3ca0a8-b633-4f9e-a89e-26f6323cfcf5",
      "status": "SUCCESS",
      "transactionId": "pay_tx_987654321"
    },
    "booking": {
      "id": "01c349eb-f857-4147-8176-905c1ec885c3",
      "bookingNumber": "TB-20261020-0001",
      "status": "CONFIRMED"
    }
  }
}
```

---

### 3. Payment Gateway Webhook
`POST /api/v1/webhooks/payment`  
**Authorization**: None (Secured via `x-webhook-signature` or `x-razorpay-signature` header)

#### Headers
```http
Content-Type: application/json
x-webhook-signature: <hmac-sha256-signature-of-raw-body>
```

#### Request Body
```json
{
  "event": "payment.captured",
  "id": "evt_gateway_123456789",
  "orderId": "order_mock_1758778546123_a9b1c2d3",
  "transactionId": "pay_tx_987654321",
  "amount": 1400,
  "currency": "INR"
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "received": true,
    "duplicate": false,
    "message": "Payment captured and booking confirmed via webhook"
  }
}
```
*Note: Duplicate webhook calls return `{"received": true, "duplicate": true}` with HTTP 200 without executing redundant operations.*

---

### 4. Get Payment Details
`GET /api/v1/payments/:id`  
**Authorization**: Bearer JWT (Owner, Customer, or Admin)

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "id": "7e3ca0a8-b633-4f9e-a89e-26f6323cfcf5",
    "orderId": "order_mock_1758778546123_a9b1c2d3",
    "amount": 1400,
    "currency": "INR",
    "status": "SUCCESS",
    "statusHistory": [
      {
        "id": "2d9b...",
        "fromStatus": "PENDING",
        "toStatus": "PENDING",
        "reason": "Payment order initiated",
        "createdAt": "2026-09-25T05:00:00.000Z"
      },
      {
        "id": "4e1a...",
        "fromStatus": "PENDING",
        "toStatus": "SUCCESS",
        "reason": "Server-side signature verified successfully",
        "createdAt": "2026-09-25T05:01:00.000Z"
      }
    ]
  }
}
```

---

### 5. Get Lightweight Payment Status
`GET /api/v1/payments/:id/status`  
**Authorization**: Bearer JWT (Customer or Admin)

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "id": "7e3ca0a8-b633-4f9e-a89e-26f6323cfcf5",
    "orderId": "order_mock_1758778546123_a9b1c2d3",
    "status": "SUCCESS",
    "amount": 1400,
    "currency": "INR",
    "updatedAt": "2026-09-25T05:01:00.000Z"
  }
}
```
