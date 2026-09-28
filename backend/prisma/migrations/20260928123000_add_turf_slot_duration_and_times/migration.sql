-- AlterTable
ALTER TABLE "turfs" ADD COLUMN "open_time" VARCHAR(5) NOT NULL DEFAULT '06:00';
ALTER TABLE "turfs" ADD COLUMN "close_time" VARCHAR(5) NOT NULL DEFAULT '22:00';
ALTER TABLE "turfs" ADD COLUMN "slot_duration_minutes" INTEGER NOT NULL DEFAULT 120;

-- AlterTable
ALTER TABLE "operating_hours" ADD COLUMN "slot_duration_minutes" INTEGER DEFAULT 120;
