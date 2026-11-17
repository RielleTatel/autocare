/**
 * Repair one initial e-payment invoice created by the older subscription API.
 * Dry-run by default. This never creates a payment or calls PayMongo.
 *
 * node scripts/repair-legacy-checkout-invoice.cjs --invoice <uuid> --email <account-email>
 * node scripts/repair-legacy-checkout-invoice.cjs --invoice <uuid> --email <account-email> --apply
 */
const { join } = require("node:path");
require("dotenv").config({ path: join(__dirname, "..", ".env"), quiet: true });
const { PrismaClient } = require("@prisma/client");

const ORIGIN_ACTION = "MEMBER_CHECKOUT_INVOICE_CREATED";
const MAX_CREATION_GAP_MS = 2 * 60 * 1000;
const REQUEST_WINDOW_MS = 5 * 60 * 1000;

function argumentsFrom(argv) {
  const invoiceIndex = argv.indexOf("--invoice");
  const emailIndex = argv.indexOf("--email");
  const invoiceId = argv[invoiceIndex + 1];
  const email = argv[emailIndex + 1]?.trim().toLowerCase();
  if (invoiceIndex < 0 || emailIndex < 0 || !/^[0-9a-f-]{36}$/i.test(invoiceId ?? "") || !email || email.startsWith("--")) {
    throw new Error("Pass --invoice <uuid> and --email <account-email>");
  }
  return { invoiceId, email, apply: argv.includes("--apply") };
}

async function inspect(db, { invoiceId, email }) {
  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      subscription: { include: { plan: true, user: { select: { email: true } } } },
      payments: { select: { id: true } },
    },
  });
  if (!invoice) throw new Error("Invoice not found");
  const subscription = invoice.subscription;
  if (!subscription || subscription.user.email.toLowerCase() !== email) throw new Error("Invoice does not belong to this account");

  const [earlierInvoices, existingOrigins, createRequests] = await Promise.all([
    db.invoice.count({ where: { subscriptionId: subscription.id, issuedAt: { lt: invoice.issuedAt } } }),
    db.auditLog.count({ where: { action: ORIGIN_ACTION, entityType: "Invoice", entityId: invoice.id } }),
    db.idempotencyKey.findMany({
      where: {
        // The older idempotency interceptor stored only the exact method and route.
        endpoint: "POST /api/v1/subscriptions",
        createdAt: {
          gte: new Date(subscription.startedAt.getTime() - REQUEST_WINDOW_MS),
          lte: new Date(subscription.startedAt.getTime() + REQUEST_WINDOW_MS),
        },
      },
      select: { responseBody: true },
    }),
  ]);
  const legacyCreationRequest = createRequests.some(({ responseBody }) =>
    responseBody && typeof responseBody === "object" && !Array.isArray(responseBody) &&
    responseBody.id === subscription.id && responseBody.invoiceId === undefined,
  );
  const checks = {
    activeElectronicSubscription: subscription.status === "ACTIVE" && subscription.paymentMethod === "E_PAYMENT",
    firstSubscriptionInvoice: earlierInvoices === 0 &&
      Math.abs(invoice.issuedAt.getTime() - subscription.startedAt.getTime()) <= MAX_CREATION_GAP_MS,
    originalPlanAmount: invoice.totalCentavos > 0n && invoice.totalCentavos === subscription.plan.priceCentavos,
    unpaidInitialInvoice: invoice.status === "AWAITING_AUTO_CHARGE" && invoice.workOrderId === null && invoice.payments.length === 0,
    olderApiCreationResponse: legacyCreationRequest,
    noExistingOrigin: existingOrigins === 0,
  };
  return { invoice, subscription, checks, eligible: Object.values(checks).every(Boolean) };
}

async function main() {
  const args = argumentsFrom(process.argv.slice(2));
  const prisma = new PrismaClient();
  try {
    const before = await inspect(prisma, args);
    console.log(JSON.stringify({
      mode: args.apply ? "apply" : "dry-run",
      invoice: before.invoice.number,
      invoiceStatus: before.invoice.status,
      subscriptionId: before.subscription.id,
      checks: before.checks,
      eligible: before.eligible,
    }));
    if (!before.eligible) {
      process.exitCode = 1;
      return;
    }
    if (!args.apply) return;

    await prisma.$transaction(async (tx) => {
      const checked = await inspect(tx, args);
      if (!checked.eligible) throw new Error("Invoice changed during repair; no marker written");
      await tx.auditLog.create({ data: {
        actorUserId: checked.subscription.userId,
        action: ORIGIN_ACTION,
        entityType: "Invoice",
        entityId: checked.invoice.id,
        after: {
          kind: "INITIAL_SUBSCRIPTION",
          subscriptionId: checked.subscription.id,
          planId: checked.subscription.planId,
        },
      } });
    });
    console.log(JSON.stringify({ applied: true, invoice: before.invoice.number, paymentCreated: false }));
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(JSON.stringify({ applied: false, error: error.code ?? error.message }));
    process.exitCode = 1;
  });
}

module.exports = { argumentsFrom, inspect };
