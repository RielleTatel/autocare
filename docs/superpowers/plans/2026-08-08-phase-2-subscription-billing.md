# Phase 2 — Subscription & Billing Spine Implementation Plan (DRAFT)

> **Status: DRAFT** — expand into bite-sized TDD steps at phase start. The invoice state machine and entitlement service below are specified exactly and should be implemented as written.
> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Money in: a member subscribes a vehicle to a plan (COD or e-payment), invoices issue and settle through the full grace/past-due/suspended lifecycle, entitlements are tracked per cycle, and staff can record cash with shift accountability.

**Covers:** M2 (FR-016→FR-030) + M8 (FR-083→FR-089). Screens M-08, M-09, M-28→M-31; W-13, W-14; A-03. BR-01, BR-03, BR-08.

**Prerequisites:** Phases 0–1. PayMongo sandbox merchant account (apply for production NOW — multi-week lead, risk R-04).

## Global Constraints (additional)

- All amounts integer centavos (`bigint`), columns `*_centavos`. ETF default (D-3): remaining lock-in months × 50% of monthly fee.
- Billing dates computed in `Asia/Manila` (a subscription started Jan 31 bills on the last day of shorter months).
- `Idempotency-Key` header required on `POST /subscriptions`, `/payments/intents`, `/payments/cash` (API §9.1); replay returns the original response with `DUPLICATE_REQUEST`.
- Webhooks: HMAC-verified, persisted raw before processing, processed exactly-once via `(provider, event_id)` unique (FR-088).
- Plans are versioned, never mutated: editing a live plan archives it and creates a new version; existing subscriptions keep their version's terms (FR-030, Data Model §8.4).

## Tasks

### Task 1: Schema — billing tables
`Plan`, `PlanEntitlement` (types `INSPECTION|PICKUP|ROADSIDE|OIL_CHANGE|TIRE_ROTATION`), `Subscription` (status `ACTIVE|GRACE|PAST_DUE|SUSPENDED|CANCELLED`, `lockInEndsAt`, `currentPeriodStart/End`, `paymentMethod E_PAYMENT|COD`), `EntitlementUsage` (unique `(subscriptionId, periodStart, entitlementType)`), `Invoice` (+`InvoiceItem`), `Payment` (method `GCASH|MAYA|CARD|CASH`, `pspReference?`, `collectedByUserId?`, `shiftId?`, `clientUuid`), `CashShift`, `PspWebhookEvent`, `IdempotencyKey`. Indexes per Data Model §8.5.

### Task 2: Invoice lifecycle state machine (pure, unit-tested first)
**Files:** `apps/api/src/modules/payments/invoice-lifecycle.ts` — pure function, no I/O:
```typescript
export type InvoiceState = "INVOICE_ISSUED" | "AWAITING_AUTO_CHARGE" | "AWAITING_CASH"
  | "RETRYING" | "GRACE" | "PAID" | "PAST_DUE" | "SUSPENDED";
export type InvoiceEvent =
  | { type: "ISSUED"; method: "E_PAYMENT" | "COD" }
  | { type: "CHARGE_SUCCEEDED" } | { type: "CHARGE_FAILED"; attempt: number }
  | { type: "CASH_RECORDED" } | { type: "DAY_ELAPSED"; daysSinceDue: number };

export function nextState(s: InvoiceState, e: InvoiceEvent): InvoiceState {
  switch (s) {
    case "INVOICE_ISSUED": return e.type === "ISSUED" ? (e.method === "E_PAYMENT" ? "AWAITING_AUTO_CHARGE" : "AWAITING_CASH") : s;
    case "AWAITING_AUTO_CHARGE":
      if (e.type === "CHARGE_SUCCEEDED") return "PAID";
      if (e.type === "CHARGE_FAILED") return "RETRYING";
      return s;
    case "RETRYING":
      if (e.type === "CHARGE_SUCCEEDED") return "PAID";
      if (e.type === "CHARGE_FAILED" && e.attempt >= 3) return "PAST_DUE";
      return s;
    case "AWAITING_CASH":
      if (e.type === "CASH_RECORDED") return "PAID";
      if (e.type === "DAY_ELAPSED" && e.daysSinceDue >= 1) return "GRACE";
      return s;
    case "GRACE":
      if (e.type === "CASH_RECORDED" || e.type === "CHARGE_SUCCEEDED") return "PAID";
      if (e.type === "DAY_ELAPSED" && e.daysSinceDue >= 8) return "PAST_DUE";
      return s;
    case "PAST_DUE":
      if (e.type === "CASH_RECORDED" || e.type === "CHARGE_SUCCEEDED") return "PAID";
      if (e.type === "DAY_ELAPSED" && e.daysSinceDue >= 15) return "SUSPENDED";
      return s;
    case "SUSPENDED":
      return e.type === "CASH_RECORDED" || e.type === "CHARGE_SUCCEEDED" ? "PAID" : s;
    case "PAID": return s;
  }
}
```
Retry schedule (FR-026): attempts on days 1, 3, 7 after first failure. Subscription status mirrors its newest invoice: `GRACE`→`GRACE`, `PAST_DUE`→`PAST_DUE`, `SUSPENDED`→`SUSPENDED` (entitlements blocked, FR-027), settle→`ACTIVE`.
**Tests:** exhaustive table test of every (state, event) pair; the COD day-1/day-8/day-15 walk; e-payment 3-retry walk (Architecture §7.6 diagram is the oracle).

### Task 3: Plans module + admin builder (FR-016, FR-030)
`GET /plans` (public), `POST/PATCH /admin/plans` (version-on-edit). Web A-03: plan builder — name, price, lock-in months, entitlement rows (type, qty/cycle, overage price). Audit-log every change (FR-103 groundwork).

### Task 4: Subscriptions module (FR-017→FR-025, FR-028)
`POST /subscriptions` (vehicleId + planId + paymentMethod; one active per vehicle; lock-in = now + plan.lockInMonths); `GET /subscriptions`, `/:id`, `/:id/entitlements`; `POST /:id/upgrade` (immediate: pro-rated charge = (newPrice−oldPrice) × remainingDays/periodDays, new invoice); `POST /:id/downgrade` (flagged, applies at next cycle); `GET /:id/cancellation-quote` → `{ etfCentavos, lockInEndsAt, remainingMonths }`; `POST /:id/cancel` (inside lock-in → requires `acceptEtf: true`, issues ETF invoice, BR-08; outside → cancels at period end). Pro-ration and ETF are pure functions in `billing-math.ts` with table tests including Manila-timezone month edges.

### Task 5: Entitlement service (FR-021, FR-022, BR-03)
**Interface consumed by Phases 3/4/6:** `EntitlementService.consume(subscriptionId, type, qty, sourceRef): Promise<ConsumeResult>` where `ConsumeResult = { ok: true } | { ok: false; reason: "EXHAUSTED"; overagePriceCentavos: number } | { ok: false; reason: "SUSPENDED" }`. Atomic upsert+increment on the unique usage row; suspended subscription → `SUSPENDED`. `resetCycle` job seeds new period rows. Tests: quota boundary, concurrent consume (transaction), suspended block.

### Task 6: PayMongo adapter behind a port (FR-083, FR-087, FR-088)
**Files:** `payments/provider.port.ts` (`createCheckout(invoice): { checkoutUrl, pspRef }`, `verifyWebhook(rawBody, signature): PspEvent`, `refund(paymentId, amount)`), `paymongo.adapter.ts`, `payments.webhook.controller.ts` (`POST /webhooks/payments` — public, raw body).
Webhook flow: verify HMAC → insert `PspWebhookEvent` (unique conflict = already seen, 200) → process in transaction (payment row, invoice event `CHARGE_SUCCEEDED`, subscription state) → mark processed. `webhooks.retryUnprocessed` job every 15 min. **Tests:** adapter against PayMongo sandbox (recorded fixtures); webhook idempotency (same event twice → one payment); bad signature → 401.

### Task 7: COD + cash shifts (FR-084→FR-086)
`POST /cash-shifts/open`, `POST /cash-shifts/:id/close` (declare counted; variance computed), `POST /payments/cash` (invoiceId, amountTendered → change; requires open shift; binds `collectedByUserId` + `shiftId`; fires `CASH_RECORDED`). `GET /admin/reports/remittance?date=` per staff totals vs counted. Offline receipt-number blocks deferred to Phase 6 (drivers); counter flow is online. Web W-13 (counter collection: lookup member → open invoices → record), W-14 (shift open/close with variance display).

### Task 8: Billing jobs (Architecture §7.8)
BullMQ processors: `billing.issueInvoices` (01:00), `billing.autoCharge` (02:00), `billing.retryFailed` (03:00, days 1/3/7 since first failure), `subscription.evaluateStates` (04:00, emits `DAY_ELAPSED`), `entitlements.resetCycle` (00:30). All idempotent per (invoice, date). **Tests:** integration with injected clock — simulate a 20-day COD non-payment timeline day by day and assert the full state walk; verify no double invoice on job re-run.

### Task 9: Receipts (FR-029)
`certificates`-style async PDF job (`invoices.generatePdf`) using a headless renderer; `GET /invoices/:id/pdf` → signed URL. Itemized: plan/period or ETF, VAT line, payment method, OR-style numbering (BIR sequence, 10-yr retention note).

### Task 10: Member app screens
M-08 plan selection (tier cards: price, inclusions, quota, lock-in; comparison); M-09 payment method (COD explainer vs e-payment → PayMongo checkout in `expo-web-browser`, return deep link `autocare://payment-result`); M-28 subscription dashboard (next billing, entitlement gauges "1 of 2 inspections left", lock-in countdown); M-29 upgrade/downgrade with pro-ration preview; M-30 cancellation (quote → ETF shown plainly → confirm, NFR-030); M-31 invoices list + PDF share sheet.

## Exit criteria
- Sandbox e-payment subscription: checkout → webhook → PAID → ACTIVE, visible on iOS.
- COD subscription walks ISSUED→GRACE→PAST_DUE→SUSPENDED→PAID correctly under the simulated clock; counter collection reactivates it.
- Entitlement consume/exhaust/overage paths tested; state machine table tests 100% branch coverage.
- Remittance report reconciles a day of mixed cash collections.
