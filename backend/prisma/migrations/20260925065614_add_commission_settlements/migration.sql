-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'ON_HOLD');

-- CreateTable
CREATE TABLE "owner_commission_configs" (
    "id" UUID NOT NULL,
    "turf_owner_id" UUID NOT NULL,
    "commission_rate" DECIMAL(5,2) NOT NULL DEFAULT 10.00,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "effective_from" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "set_by_admin_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "owner_commission_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_transactions" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "turf_owner_id" UUID NOT NULL,
    "commission_config_id" UUID,
    "gross_amount" DECIMAL(10,2) NOT NULL,
    "commission_rate" DECIMAL(5,2) NOT NULL,
    "commission_amount" DECIMAL(10,2) NOT NULL,
    "refund_amount" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "adjustment_amount" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "net_owner_earning" DECIMAL(10,2) NOT NULL,
    "settlement_id" UUID,
    "is_settled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "commission_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlements" (
    "id" UUID NOT NULL,
    "settlement_number" VARCHAR(32) NOT NULL,
    "turf_owner_id" UUID NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "gross_amount" DECIMAL(10,2) NOT NULL,
    "commission_amount" DECIMAL(10,2) NOT NULL,
    "refund_amount" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "adjustment_amount" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "net_payout_amount" DECIMAL(10,2) NOT NULL,
    "transaction_count" INTEGER NOT NULL DEFAULT 0,
    "status" "SettlementStatus" NOT NULL DEFAULT 'PENDING',
    "processed_at" TIMESTAMPTZ(6),
    "processed_by_admin_id" UUID,
    "notes" TEXT,
    "failure_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "settlements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "owner_commission_configs_turf_owner_id_key" ON "owner_commission_configs"("turf_owner_id");

-- CreateIndex
CREATE INDEX "owner_commission_configs_turf_owner_id_is_active_idx" ON "owner_commission_configs"("turf_owner_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "commission_transactions_booking_id_key" ON "commission_transactions"("booking_id");

-- CreateIndex
CREATE INDEX "commission_transactions_turf_owner_id_is_settled_idx" ON "commission_transactions"("turf_owner_id", "is_settled");

-- CreateIndex
CREATE INDEX "commission_transactions_settlement_id_idx" ON "commission_transactions"("settlement_id");

-- CreateIndex
CREATE INDEX "commission_transactions_booking_id_idx" ON "commission_transactions"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "settlements_settlement_number_key" ON "settlements"("settlement_number");

-- CreateIndex
CREATE INDEX "settlements_turf_owner_id_status_idx" ON "settlements"("turf_owner_id", "status");

-- CreateIndex
CREATE INDEX "settlements_period_start_period_end_idx" ON "settlements"("period_start", "period_end");

-- CreateIndex
CREATE INDEX "settlements_status_idx" ON "settlements"("status");

-- AddForeignKey
ALTER TABLE "owner_commission_configs" ADD CONSTRAINT "owner_commission_configs_turf_owner_id_fkey" FOREIGN KEY ("turf_owner_id") REFERENCES "turf_owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owner_commission_configs" ADD CONSTRAINT "owner_commission_configs_set_by_admin_id_fkey" FOREIGN KEY ("set_by_admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_transactions" ADD CONSTRAINT "commission_transactions_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_transactions" ADD CONSTRAINT "commission_transactions_turf_owner_id_fkey" FOREIGN KEY ("turf_owner_id") REFERENCES "turf_owners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_transactions" ADD CONSTRAINT "commission_transactions_commission_config_id_fkey" FOREIGN KEY ("commission_config_id") REFERENCES "owner_commission_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_transactions" ADD CONSTRAINT "commission_transactions_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "settlements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_turf_owner_id_fkey" FOREIGN KEY ("turf_owner_id") REFERENCES "turf_owners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_processed_by_admin_id_fkey" FOREIGN KEY ("processed_by_admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
