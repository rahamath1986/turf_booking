-- AlterTable
ALTER TABLE "slot_holds" ADD COLUMN "time_slots" JSONB;

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN "time_slots" JSONB;
