-- Admin ops: rejection reasons for approve/reject transparency.
ALTER TABLE "turfs" ADD COLUMN IF NOT EXISTS "rejection_reason" TEXT;
ALTER TABLE "turf_owners" ADD COLUMN IF NOT EXISTS "rejection_reason" TEXT;
