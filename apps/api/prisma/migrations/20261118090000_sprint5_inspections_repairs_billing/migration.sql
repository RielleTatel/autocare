CREATE TYPE "InvoiceDocumentKind" AS ENUM ('BILL', 'NO_CHARGE');
CREATE TYPE "InvoiceItemSource" AS ENUM ('LEGACY', 'SERVICE', 'REPAIR');
CREATE TYPE "AppointmentBillingStatus" AS ENUM ('PENDING', 'RETURNED', 'ISSUED');
CREATE TYPE "InspectionTemplateScope" AS ENUM ('FULL', 'FOCUSED');
CREATE TYPE "InspectionScope" AS ENUM ('FULL', 'FOCUSED', 'LEGACY_UNKNOWN');
CREATE TYPE "InspectionPhotoTarget" AS ENUM ('RESULT', 'OBSERVATION');
CREATE TYPE "RepairWorkflowStatus" AS ENUM ('IN_PROGRESS', 'AWAITING_ADMIN_REVIEW', 'RETURNED_FOR_CORRECTION', 'VERIFIED', 'STOPPED');
CREATE TYPE "SimpleRepairOperationAction" AS ENUM ('UPDATE', 'SCHEDULE_RETURN', 'COMPLETE', 'STOP', 'ADMIN_RETURN', 'ADMIN_ISSUE');

CREATE TABLE "inspection_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "scope" "InspectionTemplateScope" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "inspection_templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "inspection_templates_scope_is_active_idx" ON "inspection_templates"("scope", "is_active");

ALTER TABLE "checklist_versions" ADD COLUMN "template_id" UUID;
ALTER TABLE "service_types" ADD COLUMN "inspection_template_version_id" UUID;
ALTER TABLE "appointments"
  ADD COLUMN "service_name_snapshot" TEXT,
  ADD COLUMN "service_price_centavos_snapshot" BIGINT,
  ADD COLUMN "currency_snapshot" TEXT,
  ADD COLUMN "inspection_required_snapshot" BOOLEAN,
  ADD COLUMN "inspection_template_version_id" UUID,
  ADD COLUMN "covered_by_subscription" BOOLEAN,
  ADD COLUMN "billing_snapshot_known" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "billing_status" "AppointmentBillingStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "billing_version" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "final_service_charge_centavos" BIGINT;
ALTER TABLE "appointments" ADD COLUMN "repair_return_work_order_id" UUID;
CREATE UNIQUE INDEX "appointments_repair_return_work_order_id_key" ON "appointments"("repair_return_work_order_id");

ALTER TABLE "inspections"
  ADD COLUMN "scope" "InspectionScope" NOT NULL DEFAULT 'LEGACY_UNKNOWN',
  ADD COLUMN "template_name_snapshot" TEXT,
  ADD COLUMN "service_name_snapshot" TEXT;

CREATE TABLE "inspection_observations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "client_uuid" TEXT NOT NULL,
    "inspection_id" UUID NOT NULL,
    "notes" TEXT NOT NULL,
    "photo_urls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inspection_observations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "inspection_observations_client_uuid_key" ON "inspection_observations"("client_uuid");
CREATE INDEX "inspection_observations_inspection_id_created_at_idx" ON "inspection_observations"("inspection_id", "created_at");
ALTER TABLE "inspection_observations" ADD CONSTRAINT "inspection_observations_inspection_id_fkey"
  FOREIGN KEY ("inspection_id") REFERENCES "inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "inspection_photos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "client_uuid" TEXT NOT NULL,
    "inspection_id" UUID NOT NULL,
    "target" "InspectionPhotoTarget" NOT NULL,
    "point_code" TEXT,
    "observation_id" UUID,
    "storage_path" TEXT NOT NULL,
    "attached_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inspection_photos_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "inspection_photos_target_check" CHECK (
      ("target" = 'RESULT' AND "point_code" IS NOT NULL AND "observation_id" IS NULL) OR
      ("target" = 'OBSERVATION' AND "point_code" IS NULL AND "observation_id" IS NOT NULL)
    )
);
CREATE UNIQUE INDEX "inspection_photos_client_uuid_key" ON "inspection_photos"("client_uuid");
CREATE INDEX "inspection_photos_inspection_id_target_idx" ON "inspection_photos"("inspection_id", "target");
CREATE INDEX "inspection_photos_observation_id_idx" ON "inspection_photos"("observation_id");
ALTER TABLE "inspection_photos" ADD CONSTRAINT "inspection_photos_inspection_id_fkey"
  FOREIGN KEY ("inspection_id") REFERENCES "inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inspection_photos" ADD CONSTRAINT "inspection_photos_observation_id_fkey"
  FOREIGN KEY ("observation_id") REFERENCES "inspection_observations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "work_orders"
  ADD COLUMN "simple_repair" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "repair_origin_service_type_id" UUID,
  ADD COLUMN "repair_client_uuid" TEXT,
  ADD COLUMN "repair_status" "RepairWorkflowStatus",
  ADD COLUMN "repair_version" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "repair_notes" TEXT,
  ADD COLUMN "estimated_repair_centavos" BIGINT,
  ADD COLUMN "final_repair_centavos" BIGINT,
  ADD COLUMN "repair_rechecked" BOOLEAN,
  ADD COLUMN "repair_completion_notes" TEXT,
  ADD COLUMN "completed_work_notes" TEXT,
  ADD COLUMN "repair_stop_reason" TEXT,
  ADD COLUMN "repair_review_reason" TEXT,
  ADD COLUMN "repair_started_at" TIMESTAMP(3),
  ADD COLUMN "repair_completed_at" TIMESTAMP(3),
  ADD COLUMN "repair_stopped_at" TIMESTAMP(3),
  ADD COLUMN "repair_verified_at" TIMESTAMP(3),
  ADD COLUMN "repair_verified_by_user_id" UUID;

CREATE UNIQUE INDEX "work_orders_repair_client_uuid_key" ON "work_orders"("repair_client_uuid");
CREATE UNIQUE INDEX "work_orders_simple_repair_inspection_id_key" ON "work_orders"("inspection_id")
  WHERE "simple_repair" = true AND "inspection_id" IS NOT NULL;
CREATE INDEX "work_orders_repair_status_idx" ON "work_orders"("repair_status");
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_inspection_id_fkey"
  FOREIGN KEY ("inspection_id") REFERENCES "inspections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_repair_origin_service_type_id_fkey"
  FOREIGN KEY ("repair_origin_service_type_id") REFERENCES "service_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_repair_return_work_order_id_fkey"
  FOREIGN KEY ("repair_return_work_order_id") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_estimated_repair_centavos_check"
  CHECK ("estimated_repair_centavos" IS NULL OR "estimated_repair_centavos" >= 0);
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_final_repair_centavos_check"
  CHECK ("final_repair_centavos" IS NULL OR "final_repair_centavos" >= 0);

CREATE TABLE "simple_repair_operations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "operation_id" TEXT NOT NULL,
    "work_order_id" UUID NOT NULL,
    "action" "SimpleRepairOperationAction" NOT NULL,
    "response" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "simple_repair_operations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "simple_repair_operations_operation_id_key" ON "simple_repair_operations"("operation_id");
CREATE INDEX "simple_repair_operations_work_order_id_created_at_idx" ON "simple_repair_operations"("work_order_id", "created_at");
ALTER TABLE "simple_repair_operations" ADD CONSTRAINT "simple_repair_operations_work_order_id_fkey"
  FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "invoices"
  ADD COLUMN "appointment_id" UUID,
  ADD COLUMN "document_kind" "InvoiceDocumentKind" NOT NULL DEFAULT 'BILL';
CREATE UNIQUE INDEX "invoices_appointment_id_key" ON "invoices"("appointment_id");
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_appointment_id_fkey"
  FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoice_items" ADD COLUMN "source" "InvoiceItemSource" NOT NULL DEFAULT 'LEGACY';
ALTER TABLE "payments"
  ADD COLUMN "cash_tendered_centavos" BIGINT,
  ADD COLUMN "change_centavos" BIGINT;

CREATE TABLE "appointment_billing_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "appointment_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "operation_id" TEXT,
    "action" TEXT NOT NULL,
    "notes" TEXT,
    "before" JSONB,
    "after" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "appointment_billing_history_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "appointment_billing_history_appointment_id_created_at_idx" ON "appointment_billing_history"("appointment_id", "created_at");
CREATE UNIQUE INDEX "appointment_billing_history_operation_id_key" ON "appointment_billing_history"("operation_id");
ALTER TABLE "appointment_billing_history" ADD CONSTRAINT "appointment_billing_history_appointment_id_fkey"
  FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "appointment_billing_history" ADD CONSTRAINT "appointment_billing_history_actor_user_id_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "checklist_versions" ADD CONSTRAINT "checklist_versions_template_id_fkey"
  FOREIGN KEY ("template_id") REFERENCES "inspection_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_appointment_id_fkey"
  FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "service_types" ADD CONSTRAINT "service_types_inspection_template_version_id_fkey"
  FOREIGN KEY ("inspection_template_version_id") REFERENCES "checklist_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_inspection_template_version_id_fkey"
  FOREIGN KEY ("inspection_template_version_id") REFERENCES "checklist_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
