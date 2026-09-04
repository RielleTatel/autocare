-- CreateEnum
CREATE TYPE "AnnouncementKind" AS ENUM ('SERVICE_DUE', 'APPOINTMENT_BOOKED', 'APPOINTMENT_REMINDER', 'APPOINTMENT_RESCHEDULED', 'APPOINTMENT_CANCELLED', 'SERVICE_COMPLETED', 'ADMIN_BROADCAST');

-- CreateEnum
CREATE TYPE "AnnouncementStatus" AS ENUM ('ACTIVE', 'SUPERSEDED', 'DISMISSED');

-- CreateTable
CREATE TABLE "announcements" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "kind" "AnnouncementKind" NOT NULL,
    "status" "AnnouncementStatus" NOT NULL DEFAULT 'ACTIVE',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "vehicle_id" UUID,
    "service_type_id" UUID,
    "appointment_id" UUID,
    "reason" TEXT,
    "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcement_reads" (
    "announcement_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcement_reads_pkey" PRIMARY KEY ("announcement_id","user_id")
);

-- CreateIndex
CREATE INDEX "announcements_user_id_status_published_at_idx" ON "announcements"("user_id", "status", "published_at");

-- AddForeignKey
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- At most one OPEN thread per (member, vehicle, service type). This MUST be partial:
-- closed threads stay in the table as history, so a total unique constraint would stop
-- the next service cycle from ever opening a new thread for the same combination.
-- Prisma cannot express partial unique indexes in schema.prisma, so it lives here.
CREATE UNIQUE INDEX "announcements_open_thread"
  ON "announcements" ("user_id", "vehicle_id", "service_type_id")
  WHERE "status" = 'ACTIVE';
