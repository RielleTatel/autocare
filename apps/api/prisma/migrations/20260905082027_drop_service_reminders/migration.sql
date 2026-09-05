-- DropForeignKey
ALTER TABLE "service_reminders" DROP CONSTRAINT "service_reminders_service_type_id_fkey";

-- DropForeignKey
ALTER TABLE "service_reminders" DROP CONSTRAINT "service_reminders_vehicle_id_fkey";

-- DropTable
DROP TABLE "service_reminders";

