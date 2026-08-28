import type { PrismaService } from "../src/modules/prisma/prisma.service";

/**
 * Idempotent fixture teardown for the e2e specs.
 *
 * These specs share one hosted database and clean up in `afterAll` — but
 * `afterAll` never runs when `beforeAll` throws. One aborted run therefore left
 * fixtures behind, and every later run died on
 * "Unique constraint failed on the fields: (firebase_uid)". Eight orphaned
 * users were found that way on 2026-08-28, the oldest five days stale.
 *
 * Calling this at the TOP of `beforeAll` makes setup self-healing: the spec
 * clears its own well-known keys before creating them, so an aborted run can no
 * longer poison the next one.
 *
 * Only ever pass hardcoded identifiers. Ids minted at runtime (random UUIDs,
 * generated invoice numbers) cannot collide across runs and must not be purged
 * by prefix — this must never become a blanket delete against a shared database.
 */
export interface FixtureKeys {
  /** Well-known `User.firebaseUid` values the spec creates. */
  firebaseUids?: string[];
  /** Well-known `Vehicle.plateNo` values the spec creates. */
  plateNos?: string[];
  /** Well-known `Plan.code` values the spec creates. */
  planCodes?: string[];
}

/** Narrow view of the client, so the ordering is unit-testable without a database. */
type Db = Pick<
  PrismaService,
  | "payment" | "invoiceItem" | "invoice" | "entitlementUsage" | "subscription"
  | "workOrderItem" | "workOrder" | "categoryScore" | "healthScore"
  | "inspectionResult" | "inspection" | "certificate" | "recommendation"
  | "serviceReminder" | "appointment" | "odometerReading" | "vehicle"
  | "cashShift" | "staffShift" | "consentRecord" | "dataRequest" | "user"
  | "planEntitlement" | "plan"
>;

/**
 * Deletes deepest-first. Vehicles go before their owner because the optional
 * `ownerUserId` FK is SET NULL on user deletion, which would strand the vehicle
 * and violate `vehicles_single_owner_check`.
 */
export async function purgeFixtures(prisma: Db, keys: FixtureKeys): Promise<void> {
  const uids = keys.firebaseUids ?? [];
  const plates = keys.plateNos ?? [];
  const planCodes = keys.planCodes ?? [];

  const ownedByFixtureUser = { vehicle: { owner: { firebaseUid: { in: uids } } } };
  const fixtureVehicle = plates.length > 0 ? { plateNo: { in: plates } } : undefined;

  if (uids.length > 0) {
    // Money graph hanging off the users' subscriptions.
    await prisma.payment.deleteMany({ where: { invoice: { subscription: { user: { firebaseUid: { in: uids } } } } } });
    await prisma.invoiceItem.deleteMany({ where: { invoice: { subscription: { user: { firebaseUid: { in: uids } } } } } });
    await prisma.invoice.deleteMany({ where: { subscription: { user: { firebaseUid: { in: uids } } } } });
    await prisma.entitlementUsage.deleteMany({ where: { subscription: { user: { firebaseUid: { in: uids } } } } });
    await prisma.subscription.deleteMany({ where: { user: { firebaseUid: { in: uids } } } });
  }

  // Vehicle graph — reached either through the fixture owner or by plate.
  const vehicleScopes: Array<Record<string, unknown>> = [];
  if (uids.length > 0) vehicleScopes.push(ownedByFixtureUser);
  if (fixtureVehicle) vehicleScopes.push({ vehicle: fixtureVehicle });

  for (const scope of vehicleScopes) {
    await prisma.workOrderItem.deleteMany({ where: { workOrder: scope } });
    await prisma.workOrder.deleteMany({ where: scope });
    await prisma.categoryScore.deleteMany({ where: { healthScore: scope } });
    await prisma.healthScore.deleteMany({ where: scope });
    await prisma.inspectionResult.deleteMany({ where: { inspection: scope } });
    await prisma.inspection.deleteMany({ where: scope });
    await prisma.certificate.deleteMany({ where: scope });
    await prisma.recommendation.deleteMany({ where: scope });
    await prisma.serviceReminder.deleteMany({ where: scope });
    await prisma.appointment.deleteMany({ where: scope });
    await prisma.odometerReading.deleteMany({ where: scope });
  }

  if (uids.length > 0 || plates.length > 0) {
    const or: Array<Record<string, unknown>> = [];
    if (uids.length > 0) or.push({ owner: { firebaseUid: { in: uids } } });
    if (fixtureVehicle) or.push(fixtureVehicle);
    await prisma.vehicle.deleteMany({ where: { OR: or } });
  }

  if (uids.length > 0) {
    // CashShift carries a userId column but declares no `user` relation, so it
    // cannot be filtered relationally — resolve the ids first.
    const fixtureUsers = await prisma.user.findMany({
      where: { firebaseUid: { in: uids } },
      select: { id: true },
    });
    const fixtureUserIds = fixtureUsers.map((u) => u.id);
    if (fixtureUserIds.length > 0) {
      await prisma.cashShift.deleteMany({ where: { userId: { in: fixtureUserIds } } });
    }
    await prisma.staffShift.deleteMany({ where: { user: { firebaseUid: { in: uids } } } });
    await prisma.consentRecord.deleteMany({ where: { user: { firebaseUid: { in: uids } } } });
    await prisma.dataRequest.deleteMany({ where: { user: { firebaseUid: { in: uids } } } });
    await prisma.user.deleteMany({ where: { firebaseUid: { in: uids } } });
  }

  if (planCodes.length > 0) {
    await prisma.planEntitlement.deleteMany({ where: { plan: { code: { in: planCodes } } } });
    await prisma.plan.deleteMany({ where: { code: { in: planCodes } } });
  }
}
