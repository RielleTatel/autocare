/**
 * Seeds the subscription plans (FR-016/FR-030) and their entitlements.
 *
 * Without these rows there is nothing to subscribe to: the plan comparison
 * screen (M-08) is empty, no Subscription can be created, and roadside
 * eligibility (BR-02) can never return true because the guard's first check is
 * for an active subscription. Every downstream demo depends on this seed.
 *
 * Prices and inclusions mirror the fixtures the member app already tests
 * against (apps/member/src/features/account/AccountScreen.test.tsx) and the
 * design system's PlanCard example, so seeded data and UI copy agree.
 *
 * `quantityPerCycle` is per BILLING cycle — monthly here, not yearly.
 *
 * Idempotent: keyed on (code, version). `plans.code` is deliberately not
 * unique — the schema versions plans so historical subscriptions keep their
 * original terms — so this checks before inserting rather than upserting.
 *
 * Run: npx ts-node --compiler-options '{"module":"commonjs"}' prisma/seed-plans.ts
 */
import { PrismaClient, type BillingInterval, type EntitlementType } from "@prisma/client";

const prisma = new PrismaClient();

type SeedEntitlement = {
  entitlementType: EntitlementType;
  quantityPerCycle: number;
  /** Charged per unit once the cycle's allowance is used up (FR-035). */
  overagePriceCentavos: bigint;
};

type SeedPlan = {
  code: string;
  name: string;
  priceCentavos: bigint;
  billingInterval: BillingInterval;
  lockInMonths: number;
  version: number;
  entitlements: SeedEntitlement[];
};

/**
 * NOTE — the overage prices below are PLACEHOLDERS. Plan-tier and overage
 * pricing is still an open decision in `13 Constraints and Risks`, and these
 * were chosen to be plausible against the service-type prices in
 * seed-scheduling.ts (a full inspection is ₱600, an oil change ₱850). Replace
 * them once the real numbers are signed off; nothing computes from them except
 * the "paid alternative" copy shown to members who are out of allowance.
 */
export const PLANS: SeedPlan[] = [
  {
    code: "BASIC",
    name: "Care Basic",
    priceCentavos: 89_900n, // ₱899.00
    billingInterval: "MONTHLY",
    lockInMonths: 0, // no lock-in — the entry tier is meant to be cancellable
    version: 1,
    entitlements: [
      { entitlementType: "INSPECTION", quantityPerCycle: 1, overagePriceCentavos: 60_000n },
      { entitlementType: "ROADSIDE", quantityPerCycle: 1, overagePriceCentavos: 150_000n },
    ],
  },
  {
    code: "PLUS",
    name: "Care Plus",
    priceCentavos: 149_900n, // ₱1,499.00
    billingInterval: "MONTHLY",
    lockInMonths: 6, // BR-01 six-month lock-in, with BR-08's early-termination fee
    version: 1,
    entitlements: [
      { entitlementType: "INSPECTION", quantityPerCycle: 2, overagePriceCentavos: 60_000n },
      { entitlementType: "PICKUP", quantityPerCycle: 1, overagePriceCentavos: 30_000n },
      { entitlementType: "ROADSIDE", quantityPerCycle: 2, overagePriceCentavos: 150_000n },
    ],
  },
];

async function main(): Promise<void> {
  for (const plan of PLANS) {
    const existing = await prisma.plan.findFirst({
      where: { code: plan.code, version: plan.version },
      include: { entitlements: true },
    });

    if (existing) {
      console.log(`Plan ${plan.code} v${plan.version} already present (${existing.entitlements.length} entitlements)`);
      continue;
    }

    const created = await prisma.plan.create({
      data: {
        code: plan.code,
        name: plan.name,
        priceCentavos: plan.priceCentavos,
        billingInterval: plan.billingInterval,
        lockInMonths: plan.lockInMonths,
        version: plan.version,
        isActive: true,
        entitlements: { create: plan.entitlements },
      },
      include: { entitlements: true },
    });

    const inclusions = created.entitlements
      .map((e) => `${e.quantityPerCycle}× ${e.entitlementType}`)
      .join(", ");
    console.log(
      `Plan ${created.code} "${created.name}" seeded — ₱${(Number(created.priceCentavos) / 100).toLocaleString("en-PH")}/cycle, ` +
        `lock-in ${created.lockInMonths}mo, ${inclusions}`,
    );
  }
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
