-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "RefundType" AS ENUM ('FULL', 'PARTIAL', 'NONE');

-- CreateTable
CREATE TABLE "cancellation_policies" (
    "id" UUID NOT NULL,
    "turf_id" UUID NOT NULL,
    "free_cancellation_hours" INTEGER NOT NULL DEFAULT 24,
    "fixed_cancellation_fee" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "rules" JSONB NOT NULL DEFAULT '[]',
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cancellation_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" UUID NOT NULL,
    "refund_number" VARCHAR(32) NOT NULL,
    "booking_id" UUID NOT NULL,
    "payment_id" UUID,
    "user_id" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "cancellation_fee" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "refund_percentage" DECIMAL(5,2),
    "refund_type" "RefundType" NOT NULL DEFAULT 'FULL',
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "gateway_refund_id" VARCHAR(255),
    "reason" TEXT,
    "failure_reason" TEXT,
    "processed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cancellation_policies_turf_id_key" ON "cancellation_policies"("turf_id");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_refund_number_key" ON "refunds"("refund_number");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_gateway_refund_id_key" ON "refunds"("gateway_refund_id");

-- CreateIndex
CREATE INDEX "refunds_booking_id_idx" ON "refunds"("booking_id");

-- CreateIndex
CREATE INDEX "refunds_payment_id_idx" ON "refunds"("payment_id");

-- CreateIndex
CREATE INDEX "refunds_user_id_status_idx" ON "refunds"("user_id", "status");

-- CreateIndex
CREATE INDEX "refunds_refund_number_idx" ON "refunds"("refund_number");

-- AddForeignKey
ALTER TABLE "cancellation_policies" ADD CONSTRAINT "cancellation_policies_turf_id_fkey" FOREIGN KEY ("turf_id") REFERENCES "turfs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
