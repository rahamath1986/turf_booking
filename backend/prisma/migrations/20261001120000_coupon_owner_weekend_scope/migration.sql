-- Offer scoping: owner-wise coupons + weekend (day-of-week) validity.
ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "owner_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "valid_days" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
