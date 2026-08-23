-- CreateTable
CREATE TABLE "service_reminders" (
    "id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "service_type_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dismissed_at" TIMESTAMP(3),

    CONSTRAINT "service_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_reminders_vehicle_id_service_type_id_key" ON "service_reminders"("vehicle_id", "service_type_id");

-- AddForeignKey
ALTER TABLE "service_reminders" ADD CONSTRAINT "service_reminders_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_reminders" ADD CONSTRAINT "service_reminders_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "service_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
