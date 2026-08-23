-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('BOOKED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "Weekday" AS ENUM ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN');

-- CreateTable
CREATE TABLE "service_types" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "standard_duration_min" INTEGER NOT NULL,
    "required_skills" TEXT[],
    "price_centavos" BIGINT NOT NULL,
    "entitlement_type" "EntitlementType",
    "interval_days" INTEGER,
    "interval_km" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_bays" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "capabilities" TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_bays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_shifts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "date" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "skills" TEXT[],

    CONSTRAINT "staff_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operating_hours" (
    "id" UUID NOT NULL,
    "weekday" "Weekday",
    "date_override" TEXT,
    "open_time" TEXT,
    "close_time" TEXT,
    "walk_in_buffer_pct" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "operating_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capacity_blocks" (
    "id" UUID NOT NULL,
    "bay_id" UUID,
    "date" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "capacity_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "service_type_id" UUID NOT NULL,
    "bay_id" UUID,
    "scheduled_start" TIMESTAMP(3) NOT NULL,
    "scheduled_end" TIMESTAMP(3) NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'BOOKED',
    "requires_pickup" BOOLEAN NOT NULL DEFAULT false,
    "created_by" UUID NOT NULL,
    "subscription_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_types_code_key" ON "service_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "service_bays_name_key" ON "service_bays"("name");

-- CreateIndex
CREATE INDEX "staff_shifts_date_idx" ON "staff_shifts"("date");

-- CreateIndex
CREATE UNIQUE INDEX "operating_hours_weekday_key" ON "operating_hours"("weekday");

-- CreateIndex
CREATE UNIQUE INDEX "operating_hours_date_override_key" ON "operating_hours"("date_override");

-- CreateIndex
CREATE INDEX "capacity_blocks_date_idx" ON "capacity_blocks"("date");

-- CreateIndex
CREATE INDEX "appointments_scheduled_start_bay_id_idx" ON "appointments"("scheduled_start", "bay_id");

-- CreateIndex
CREATE INDEX "appointments_status_scheduled_start_idx" ON "appointments"("status", "scheduled_start");

-- AddForeignKey
ALTER TABLE "staff_shifts" ADD CONSTRAINT "staff_shifts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "service_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
