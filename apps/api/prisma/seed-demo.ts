/**
 * Demo fixtures — the accounts and history a walkthrough needs, which the
 * reference seeds deliberately do not create.
 *
 * This does NOT bypass any rule. BR-02 still runs in full: the member becomes
 * eligible for roadside because they genuinely hold an active subscription
 * whose first payment cleared more than ROADSIDE_WAITING_DAYS ago. Nothing in
 * the guard is weakened, so what you demo is what production would do.
 *
 * Creates, for `test.member@autocare.dev` (must have signed in once, so the
 * API has created their row):
 *   - a Care Plus subscription, started 60 days ago, ACTIVE
 *   - a PAID invoice and a SUCCEEDED payment dated 60 days ago
 * and separately a DRIVER staff row, so the roadside dispatch screen has
 * somebody to assign.
 *
 * Idempotent: re-running reports what already exists instead of duplicating.
 *
 * Run: npx ts-node --compiler-options '{"module":"commonjs"}' prisma/seed-demo.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const MEMBER_EMAIL = "test.member@autocare.dev";
const DRIVER_EMAIL = "test.driver@autocare.dev";
const DAY_MS = 86_400_000;

/** Comfortably past the 30-day BR-02 waiting period, without being ancient. */
const PAID_DAYS_AGO = 60;

async function seedDriver(): Promise<void> {
  const existing = await prisma.user.findFirst({ where: { email: DRIVER_EMAIL } });
  if (existing) {
    console.log(`Driver ${DRIVER_EMAIL} already present (role ${existing.role})`);
    return;
  }
  // No Firebase account: this row exists so the dispatch screen has a driver to
  // assign. Signing in AS the driver would need a Firebase user too.
  const driver = await prisma.user.create({
    data: {
      firebaseUid: `demo-driver-${Date.now()}`,
      email: DRIVER_EMAIL,
      name: "J. Cruz",
      role: "DRIVER",
      status: "ACTIVE",
    },
  });
  console.log(`Driver seeded: ${driver.name} <${driver.email}> (${driver.id})`);
}

async function seedSubscription(): Promise<void> {
  const member = await prisma.user.findFirst({ where: { email: MEMBER_EMAIL } });
  if (!member) {
    console.log(`SKIPPED: no user ${MEMBER_EMAIL}. Sign in once on the member app first — the API creates the row.`);
    return;
  }

  const vehicle = await prisma.vehicle.findFirst({ where: { ownerUserId: member.id, status: "ACTIVE" } });
  if (!vehicle) {
    console.log(`SKIPPED: ${MEMBER_EMAIL} has no active vehicle. Add one in the app first.`);
    return;
  }

  const already = await prisma.subscription.findFirst({
    where: { userId: member.id, status: { in: ["ACTIVE", "GRACE"] } },
    include: { plan: true },
  });
  if (already) {
    console.log(`Subscription already present: ${already.plan.code} (${already.status})`);
    return;
  }

  const plan = await prisma.plan.findFirst({ where: { code: "PLUS", isActive: true } });
  if (!plan) {
    console.log("SKIPPED: no PLUS plan. Run prisma/seed-plans.ts first.");
    return;
  }

  const paidAt = new Date(Date.now() - PAID_DAYS_AGO * DAY_MS);
  const subscription = await prisma.subscription.create({
    data: {
      userId: member.id,
      vehicleId: vehicle.id,
      planId: plan.id,
      status: "ACTIVE",
      startedAt: paidAt,
      // BR-01's six-month lock-in, measured from the start.
      lockInEndsAt: new Date(paidAt.getTime() + 182 * DAY_MS),
      currentPeriodStart: new Date(Date.now() - 5 * DAY_MS),
      currentPeriodEnd: new Date(Date.now() + 25 * DAY_MS),
      paymentMethod: "E_PAYMENT",
    },
  });

  const invoice = await prisma.invoice.create({
    data: {
      subscriptionId: subscription.id,
      number: `DEMO-${Date.now()}`,
      totalCentavos: plan.priceCentavos,
      status: "PAID",
      dueDate: paidAt,
      issuedAt: paidAt,
    },
  });

  // The date on THIS row is what BR-02 measures from — not the subscription's
  // start — so it has to be back-dated too.
  await prisma.payment.create({
    data: {
      invoiceId: invoice.id,
      method: "CARD",
      amountCentavos: plan.priceCentavos,
      status: "SUCCEEDED",
      clientUuid: `demo-${subscription.id}`,
      createdAt: paidAt,
    },
  });

  const opensAt = new Date(paidAt.getTime() + 30 * DAY_MS);
  console.log(
    `Subscription seeded: ${plan.code} on ${vehicle.plateNo}, paid ${paidAt.toISOString().slice(0, 10)} ` +
      `→ roadside eligible since ${opensAt.toISOString().slice(0, 10)}`,
  );
}

async function main(): Promise<void> {
  await seedDriver();
  await seedSubscription();
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
