-- Remove threads orphaned by the previous ON DELETE SET NULL behaviour: a vehicle-scoped
-- thread whose vehicle is gone is unactionable, but it stayed in the member's feed still
-- claiming a service was due on a car they no longer own.
-- Broadcasts legitimately have a NULL vehicle_id and must be kept.
DELETE FROM "announcements"
  WHERE "vehicle_id" IS NULL
    AND "kind" <> 'ADMIN_BROADCAST';

-- Re-point the foreign key at CASCADE so this cannot recur.
ALTER TABLE "announcements" DROP CONSTRAINT "announcements_vehicle_id_fkey";
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_vehicle_id_fkey"
  FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
