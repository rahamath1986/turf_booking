-- AlterTable
ALTER TABLE "turfs" ADD COLUMN     "cancellation_policy" TEXT,
ADD COLUMN     "is_featured" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "turfs_is_featured_is_active_is_approved_idx" ON "turfs"("is_featured", "is_active", "is_approved");
