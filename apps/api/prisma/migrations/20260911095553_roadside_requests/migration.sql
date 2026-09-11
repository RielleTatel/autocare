-- CreateEnum
CREATE TYPE "IncidentType" AS ENUM ('FLAT_TYRE', 'DEAD_BATTERY', 'OUT_OF_FUEL', 'OVERHEATING', 'WILL_NOT_START', 'ACCIDENT', 'OTHER');

-- CreateEnum
CREATE TYPE "RoadsideStatus" AS ENUM ('REQUESTED', 'ACKNOWLEDGED', 'DISPATCHED', 'EN_ROUTE', 'ON_SITE', 'RESOLVED');

-- CreateTable
CREATE TABLE "roadside_requests" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "incident_type" "IncidentType" NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "address" TEXT,
    "landmark_note" TEXT,
    "status" "RoadsideStatus" NOT NULL DEFAULT 'REQUESTED',
    "dispatched_to" UUID,
    "responder_name" TEXT,
    "eta_minutes" INTEGER,
    "resolution_notes" TEXT,
    "cost_centavos" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledged_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "roadside_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "roadside_requests_status_created_at_idx" ON "roadside_requests"("status", "created_at");

-- CreateIndex
CREATE INDEX "roadside_requests_user_id_created_at_idx" ON "roadside_requests"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "roadside_requests" ADD CONSTRAINT "roadside_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadside_requests" ADD CONSTRAINT "roadside_requests_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
