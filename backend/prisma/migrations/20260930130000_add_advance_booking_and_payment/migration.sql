-- AlterTable turfs
ALTER TABLE "turfs" ADD COLUMN IF NOT EXISTS "advance_payment_allowed" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "turfs" ADD COLUMN IF NOT EXISTS "min_advance_percentage" DECIMAL(5,2) NOT NULL DEFAULT 20.00;
ALTER TABLE "turfs" ADD COLUMN IF NOT EXISTS "min_advance_amount" DECIMAL(10,2) NOT NULL DEFAULT 0.00;

-- AlterTable slot_holds
ALTER TABLE "slot_holds" ADD COLUMN IF NOT EXISTS "is_advance_hold" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "slot_holds" ADD COLUMN IF NOT EXISTS "advance_amount" DECIMAL(10,2);
ALTER TABLE "slot_holds" ADD COLUMN IF NOT EXISTS "min_advance_amount" DECIMAL(10,2);

-- AlterTable bookings
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "is_advance_booking" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "advance_amount" DECIMAL(10,2) NOT NULL DEFAULT 0.00;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "paid_amount" DECIMAL(10,2) NOT NULL DEFAULT 0.00;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "remaining_amount" DECIMAL(10,2) NOT NULL DEFAULT 0.00;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "payment_status" VARCHAR(30) NOT NULL DEFAULT 'PAID';

-- Update existing confirmed bookings to have paid_amount = total_price and remaining_amount = 0
UPDATE "bookings"
SET "paid_amount" = "total_price",
    "remaining_amount" = 0.00,
    "payment_status" = 'PAID'
WHERE "paid_amount" = 0.00 AND "status" = 'CONFIRMED';

-- AlterTable payments
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "payment_type" VARCHAR(30) NOT NULL DEFAULT 'FULL';
