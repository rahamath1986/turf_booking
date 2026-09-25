-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "checked_in_at" TIMESTAMPTZ(6),
ADD COLUMN     "checked_in_by_user_id" UUID,
ADD COLUMN     "checked_out_at" TIMESTAMPTZ(6),
ADD COLUMN     "checked_out_by_user_id" UUID;

-- CreateTable
CREATE TABLE "booking_check_in_audits" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "turf_id" UUID NOT NULL,
    "action_type" VARCHAR(20) NOT NULL,
    "performed_by_user_id" UUID,
    "performed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "metadata" JSONB,

    CONSTRAINT "booking_check_in_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "booking_check_in_audits_booking_id_idx" ON "booking_check_in_audits"("booking_id");

-- CreateIndex
CREATE INDEX "booking_check_in_audits_turf_id_performed_at_idx" ON "booking_check_in_audits"("turf_id", "performed_at");

-- AddForeignKey
ALTER TABLE "booking_check_in_audits" ADD CONSTRAINT "booking_check_in_audits_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_check_in_audits" ADD CONSTRAINT "booking_check_in_audits_performed_by_user_id_fkey" FOREIGN KEY ("performed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
