ALTER TABLE "service_types" ADD COLUMN "inspection_required" BOOLEAN NOT NULL DEFAULT false;

-- Initialize the selected service once; future configuration is independent
-- of its display name, entitlement classification, and service code.
UPDATE "service_types" SET "inspection_required" = true WHERE "code" = 'FULL_INSPECTION';
