-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'PAYMENT_PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW', 'EXPIRED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "HoldStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'RELEASED', 'CONVERTED');

-- CreateTable
CREATE TABLE "slot_holds" (
    "id" UUID NOT NULL,
    "hold_code" VARCHAR(32) NOT NULL,
    "user_id" UUID NOT NULL,
    "turf_id" UUID NOT NULL,
    "sport_id" UUID,
    "hold_date" DATE NOT NULL,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "HoldStatus" NOT NULL DEFAULT 'ACTIVE',
    "total_price" DECIMAL(10,2) NOT NULL,
    "idempotency_key" VARCHAR(255),
    "active_hold_key" VARCHAR(120),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "slot_holds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL,
    "booking_number" VARCHAR(32) NOT NULL,
    "user_id" UUID NOT NULL,
    "turf_id" UUID NOT NULL,
    "sport_id" UUID,
    "slot_hold_id" UUID,
    "booking_date" DATE NOT NULL,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "duration_minutes" INTEGER NOT NULL DEFAULT 60,
    "status" "BookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "active_slot_key" VARCHAR(120),
    "idempotency_key" VARCHAR(255),
    "base_price" DECIMAL(10,2) NOT NULL,
    "tax_amount" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "discount_amount" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "total_price" DECIMAL(10,2) NOT NULL,
    "cancellation_reason" TEXT,
    "cancelled_at" TIMESTAMPTZ(6),
    "rescheduled_from_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_status_history" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "from_status" "BookingStatus",
    "to_status" "BookingStatus" NOT NULL,
    "reason" VARCHAR(255),
    "changed_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "slot_holds_hold_code_key" ON "slot_holds"("hold_code");

-- CreateIndex
CREATE UNIQUE INDEX "slot_holds_idempotency_key_key" ON "slot_holds"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "slot_holds_active_hold_key_key" ON "slot_holds"("active_hold_key");

-- CreateIndex
CREATE INDEX "slot_holds_turf_id_hold_date_start_time_idx" ON "slot_holds"("turf_id", "hold_date", "start_time");

-- CreateIndex
CREATE INDEX "slot_holds_user_id_status_idx" ON "slot_holds"("user_id", "status");

-- CreateIndex
CREATE INDEX "slot_holds_expires_at_status_idx" ON "slot_holds"("expires_at", "status");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_booking_number_key" ON "bookings"("booking_number");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_active_slot_key_key" ON "bookings"("active_slot_key");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_idempotency_key_key" ON "bookings"("idempotency_key");

-- CreateIndex
CREATE INDEX "bookings_turf_id_booking_date_start_time_idx" ON "bookings"("turf_id", "booking_date", "start_time");

-- CreateIndex
CREATE INDEX "bookings_user_id_status_idx" ON "bookings"("user_id", "status");

-- CreateIndex
CREATE INDEX "bookings_status_booking_date_idx" ON "bookings"("status", "booking_date");

-- CreateIndex
CREATE INDEX "bookings_booking_number_idx" ON "bookings"("booking_number");

-- CreateIndex
CREATE INDEX "booking_status_history_booking_id_created_at_idx" ON "booking_status_history"("booking_id", "created_at");

-- AddForeignKey
ALTER TABLE "slot_holds" ADD CONSTRAINT "slot_holds_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slot_holds" ADD CONSTRAINT "slot_holds_turf_id_fkey" FOREIGN KEY ("turf_id") REFERENCES "turfs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slot_holds" ADD CONSTRAINT "slot_holds_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "sports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_turf_id_fkey" FOREIGN KEY ("turf_id") REFERENCES "turfs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "sports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_slot_hold_id_fkey" FOREIGN KEY ("slot_hold_id") REFERENCES "slot_holds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_rescheduled_from_id_fkey" FOREIGN KEY ("rescheduled_from_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_status_history" ADD CONSTRAINT "booking_status_history_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_status_history" ADD CONSTRAINT "booking_status_history_changed_by_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
