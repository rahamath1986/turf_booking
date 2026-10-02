-- Manager/staff-to-owner scoping for turf-level access control.
CREATE TABLE IF NOT EXISTS "staff_assignments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "user_id" UUID NOT NULL UNIQUE,
  "turf_owner_id" UUID NOT NULL,
  "turf_id" UUID,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "staff_assignments_turf_owner_id_is_active_idx" ON "staff_assignments"("turf_owner_id", "is_active");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staff_assignments_user_id_fkey') THEN
    ALTER TABLE "staff_assignments" ADD CONSTRAINT "staff_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staff_assignments_turf_owner_id_fkey') THEN
    ALTER TABLE "staff_assignments" ADD CONSTRAINT "staff_assignments_turf_owner_id_fkey" FOREIGN KEY ("turf_owner_id") REFERENCES "turf_owners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staff_assignments_turf_id_fkey') THEN
    ALTER TABLE "staff_assignments" ADD CONSTRAINT "staff_assignments_turf_id_fkey" FOREIGN KEY ("turf_id") REFERENCES "turfs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
