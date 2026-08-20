-- CreateEnum
CREATE TYPE "OrgType" AS ENUM ('FLEET', 'INTERNAL');

-- AlterTable
ALTER TABLE "odometer_readings" ADD COLUMN     "justification" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "address" TEXT,
ADD COLUMN     "emergency_contact_mobile" TEXT,
ADD COLUMN     "emergency_contact_name" TEXT,
ADD COLUMN     "erasure_requested_at" TIMESTAMP(3),
ADD COLUMN     "org_id" UUID;

-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "or_cr_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "owner_org_id" UUID,
ADD COLUMN     "photo_urls" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "OrgType" NOT NULL,
    "tin" TEXT,
    "billing_contact" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_owner_org_id_fkey" FOREIGN KEY ("owner_org_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Defensive cleanup: remove any stale vehicle rows with no owner before adding the check constraint
DELETE FROM vehicles WHERE owner_user_id IS NULL AND owner_org_id IS NULL;

-- CheckConstraint: exactly one of owner_user_id / owner_org_id must be set
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_single_owner_check"
  CHECK (num_nonnulls("owner_user_id", "owner_org_id") = 1);
