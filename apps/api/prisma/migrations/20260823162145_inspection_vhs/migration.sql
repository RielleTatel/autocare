-- CreateEnum
CREATE TYPE "PointStatus" AS ENUM ('GOOD', 'MONITOR', 'ATTENTION', 'CRITICAL', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "PointInputType" AS ENUM ('STATUS', 'MEASURED');

-- CreateEnum
CREATE TYPE "ThresholdDirection" AS ENUM ('HIGHER_BETTER', 'LOWER_BETTER');

-- CreateEnum
CREATE TYPE "ChecklistStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "VhsBand" AS ENUM ('EXCELLENT', 'GOOD', 'FAIR', 'NEEDS_ATTENTION', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ScoreConfidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "ScoreOverride" AS ENUM ('NONE', 'SAFETY_CRITICAL', 'SAFETY_ATTENTION');

-- CreateEnum
CREATE TYPE "CertificateVisibility" AS ENUM ('PRIVATE', 'LINK', 'REVOKED');

-- CreateEnum
CREATE TYPE "SyncReceiptStatus" AS ENUM ('APPLIED', 'DUPLICATE', 'REJECTED');

-- CreateTable
CREATE TABLE "checklist_versions" (
    "id" UUID NOT NULL,
    "version_label" TEXT NOT NULL,
    "weight_version" TEXT NOT NULL,
    "status" "ChecklistStatus" NOT NULL DEFAULT 'DRAFT',
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checklist_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_categories" (
    "id" UUID NOT NULL,
    "checklist_version_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "label_fil" TEXT,
    "weight" DOUBLE PRECISION NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "checklist_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_points" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "label_fil" TEXT,
    "weight_in_category" DOUBLE PRECISION NOT NULL,
    "is_safety_critical" BOOLEAN NOT NULL DEFAULT false,
    "input_type" "PointInputType" NOT NULL,
    "unit" TEXT,
    "threshold_direction" "ThresholdDirection",
    "threshold_good" DOUBLE PRECISION,
    "threshold_monitor" DOUBLE PRECISION,
    "threshold_attention" DOUBLE PRECISION,
    "recommendation" TEXT NOT NULL,
    "templates" JSONB,
    "requires_photo_on_adverse" BOOLEAN NOT NULL DEFAULT false,
    "not_applicable_when" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "checklist_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspections" (
    "id" UUID NOT NULL,
    "client_uuid" TEXT NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "appointment_id" UUID,
    "mechanic_id" UUID NOT NULL,
    "checklist_version_id" UUID NOT NULL,
    "odometer_km" INTEGER,
    "started_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3),
    "notes" TEXT,
    "supersedes_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_results" (
    "id" UUID NOT NULL,
    "inspection_id" UUID NOT NULL,
    "point_id" UUID NOT NULL,
    "point_code" TEXT NOT NULL,
    "status" "PointStatus",
    "measured_value" DOUBLE PRECISION,
    "notes" TEXT,
    "photo_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspection_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_scores" (
    "id" UUID NOT NULL,
    "inspection_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "score" INTEGER NOT NULL,
    "raw_score" DOUBLE PRECISION NOT NULL,
    "band" "VhsBand" NOT NULL,
    "confidence" "ScoreConfidence" NOT NULL,
    "override_applied" "ScoreOverride" NOT NULL DEFAULT 'NONE',
    "checklist_version_id" UUID NOT NULL,
    "weight_version" TEXT NOT NULL,
    "top_detractors" JSONB NOT NULL DEFAULT '[]',
    "is_stale" BOOLEAN NOT NULL DEFAULT false,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "health_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_scores" (
    "id" UUID NOT NULL,
    "health_score_id" UUID NOT NULL,
    "category_code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "applicable_points" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "category_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendations" (
    "id" UUID NOT NULL,
    "health_score_id" UUID NOT NULL,
    "point_code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "severity" "PointStatus" NOT NULL,
    "recommendation" TEXT NOT NULL,
    "estimated_cost_centavos" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificates" (
    "id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "health_score_id" UUID NOT NULL,
    "public_token" TEXT NOT NULL,
    "verification_code" TEXT NOT NULL,
    "visibility" "CertificateVisibility" NOT NULL DEFAULT 'PRIVATE',
    "pdf_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_outbox_receipts" (
    "id" UUID NOT NULL,
    "client_uuid" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "op" TEXT NOT NULL,
    "status" "SyncReceiptStatus" NOT NULL,
    "error_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_outbox_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "checklist_versions_version_label_key" ON "checklist_versions"("version_label");

-- CreateIndex
CREATE INDEX "checklist_versions_is_active_idx" ON "checklist_versions"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "checklist_categories_checklist_version_id_code_key" ON "checklist_categories"("checklist_version_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "checklist_points_category_id_code_key" ON "checklist_points"("category_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "inspections_client_uuid_key" ON "inspections"("client_uuid");

-- CreateIndex
CREATE UNIQUE INDEX "inspections_supersedes_id_key" ON "inspections"("supersedes_id");

-- CreateIndex
CREATE INDEX "inspections_vehicle_id_created_at_idx" ON "inspections"("vehicle_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "inspection_results_inspection_id_point_code_key" ON "inspection_results"("inspection_id", "point_code");

-- CreateIndex
CREATE UNIQUE INDEX "health_scores_inspection_id_key" ON "health_scores"("inspection_id");

-- CreateIndex
CREATE INDEX "health_scores_vehicle_id_computed_at_idx" ON "health_scores"("vehicle_id", "computed_at");

-- CreateIndex
CREATE INDEX "health_scores_is_stale_computed_at_idx" ON "health_scores"("is_stale", "computed_at");

-- CreateIndex
CREATE UNIQUE INDEX "category_scores_health_score_id_category_code_key" ON "category_scores"("health_score_id", "category_code");

-- CreateIndex
CREATE INDEX "recommendations_health_score_id_idx" ON "recommendations"("health_score_id");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_public_token_key" ON "certificates"("public_token");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_verification_code_key" ON "certificates"("verification_code");

-- CreateIndex
CREATE INDEX "certificates_vehicle_id_idx" ON "certificates"("vehicle_id");

-- CreateIndex
CREATE UNIQUE INDEX "sync_outbox_receipts_client_uuid_key" ON "sync_outbox_receipts"("client_uuid");

-- CreateIndex
CREATE INDEX "sync_outbox_receipts_user_id_created_at_idx" ON "sync_outbox_receipts"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "checklist_categories" ADD CONSTRAINT "checklist_categories_checklist_version_id_fkey" FOREIGN KEY ("checklist_version_id") REFERENCES "checklist_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_points" ADD CONSTRAINT "checklist_points_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "checklist_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_mechanic_id_fkey" FOREIGN KEY ("mechanic_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_checklist_version_id_fkey" FOREIGN KEY ("checklist_version_id") REFERENCES "checklist_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_supersedes_id_fkey" FOREIGN KEY ("supersedes_id") REFERENCES "inspections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_results" ADD CONSTRAINT "inspection_results_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "inspections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_results" ADD CONSTRAINT "inspection_results_point_id_fkey" FOREIGN KEY ("point_id") REFERENCES "checklist_points"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_scores" ADD CONSTRAINT "health_scores_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "inspections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_scores" ADD CONSTRAINT "health_scores_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_scores" ADD CONSTRAINT "health_scores_checklist_version_id_fkey" FOREIGN KEY ("checklist_version_id") REFERENCES "checklist_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_scores" ADD CONSTRAINT "category_scores_health_score_id_fkey" FOREIGN KEY ("health_score_id") REFERENCES "health_scores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_health_score_id_fkey" FOREIGN KEY ("health_score_id") REFERENCES "health_scores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_health_score_id_fkey" FOREIGN KEY ("health_score_id") REFERENCES "health_scores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
