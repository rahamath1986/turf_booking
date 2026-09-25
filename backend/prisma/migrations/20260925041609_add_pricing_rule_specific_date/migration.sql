-- AlterTable
ALTER TABLE "pricing_rules" ADD COLUMN     "specific_date" DATE;

-- CreateIndex
CREATE INDEX "pricing_rules_turf_id_specific_date_idx" ON "pricing_rules"("turf_id", "specific_date");
