-- Roadside status updates reach the member's feed.
--
-- They cannot ride the (user, vehicle, service type) thread index: a roadside
-- incident has no service type. Keyed on the incident instead, one ACTIVE row
-- per request, superseded on each status change.

-- Safe inside Prisma's transaction on PG 12+: the value is added here and first
-- used by a later statement in a later transaction.
ALTER TYPE "AnnouncementKind" ADD VALUE IF NOT EXISTS 'ROADSIDE_UPDATE';

ALTER TABLE "announcements" ADD COLUMN IF NOT EXISTS "roadside_request_id" UUID;

-- Finds the open update for one incident, which is the only query this column serves.
CREATE INDEX IF NOT EXISTS "announcements_roadside_open"
  ON "announcements" ("roadside_request_id")
  WHERE "status" = 'ACTIVE';
