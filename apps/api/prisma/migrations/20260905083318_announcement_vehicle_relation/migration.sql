-- Orphans can exist from before the column was a foreign key: rows whose vehicle was deleted
-- while vehicle_id was just a bare uuid. They reference nothing and cannot satisfy the
-- constraint, so they are removed before it is added. Broadcasts (vehicle_id IS NULL) are kept.
DELETE FROM "announcements"
  WHERE "vehicle_id" IS NOT NULL
    AND "vehicle_id" NOT IN (SELECT "id" FROM "vehicles");

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
