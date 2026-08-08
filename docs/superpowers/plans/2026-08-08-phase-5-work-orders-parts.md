# Phase 5 — Work Orders & Parts Implementation Plan (DRAFT)

> **Status: DRAFT** — expand into bite-sized TDD steps at phase start.
> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Inspection findings become quotable work items; the member approves, declines, or defers each line in-app before work proceeds; closed work orders append to the permanent service record with parts, stock, and hazardous-waste accounting.

**Covers:** M6 (FR-066→FR-074). Screens W-05→W-09; M-25, M-17, M-18; F-10. BR-07. C-08 groundwork (waste capture; DENR export itself is Phase 7).

**Prerequisites:** Phases 0–4 (recommendations exist from inspection findings; billing can invoice work orders).

## Global Constraints (additional)

- Approval threshold (BR-07, default D-4: ₱1,500 = `150000` centavos) is admin configuration; any work-order total above it requires explicit member approval before status can advance to `APPROVED` — enforced server-side (`APPROVAL_REQUIRED` 409), not just hidden in UI.
- Work order status machine is strict: `DRAFT → AWAITING_APPROVAL → APPROVED → IN_PROGRESS → QC → READY → CLOSED`; illegal transitions rejected. Cancel allowed from DRAFT/AWAITING_APPROVAL only.
- Parts and labour itemized separately with qty, unit price, member discount (FR-071); all centavos.
- Closed work orders are immutable and append to the vehicle service record (FR-073, NFR-057).
- Stock decrements on closure, not on quoting (FR-072); stock can go negative only with an advisor override flag (real workshops run ahead of the system).

## Tasks

### Task 1: Schema — work order tables
`WorkOrder { vehicleId, appointmentId?, number unique (WO-YYYYMM-####), status, customerComplaint, technicianSummary, advisorUserId, openedAt, closedAt? }`, `WorkOrderItem { type PART|LABOR, partId?, description, qty, unitPriceCentavos, discountCentavos, approvalStatus PENDING|APPROVED|DECLINED|DEFERRED, approvedAt?, recommendationId? }`, `Part { sku, name, category, costCentavos, priceCentavos, stockQty, reorderLevel }`, `WasteRecord { workOrderId, wasteType USED_OIL|BATTERY|FILTER|TIRE|COOLANT, quantity, unit, haulerName?, manifestNo?, disposedAt? }`. Seed a starter parts catalogue (~40 common SKUs: oils, filters, pads, batteries).

### Task 2: Work order lifecycle service (FR-070)
Pure transition function + service wrapper:
```typescript
const transitions: Record<WoStatus, WoStatus[]> = {
  DRAFT: ["AWAITING_APPROVAL", "APPROVED", "CANCELLED"],   // straight to APPROVED only if total ≤ threshold
  AWAITING_APPROVAL: ["APPROVED", "DRAFT", "CANCELLED"],
  APPROVED: ["IN_PROGRESS"], IN_PROGRESS: ["QC"], QC: ["READY", "IN_PROGRESS"],
  READY: ["CLOSED"], CLOSED: [], CANCELLED: [],
};
```
Guard: `DRAFT→APPROVED` allowed only when `approvableTotal(items) <= thresholdCentavos`; otherwise must pass through `AWAITING_APPROVAL` with every non-declined line decided (FR-067/068). `approvableTotal` counts PENDING+APPROVED lines net of discounts. Closure requires: all APPROVED lines done, technician summary present, waste recorded if any line's part category demands it (oil change ⇒ USED_OIL record). **Tests:** transition table exhaustive; threshold boundary (exactly ₱1,500 → no approval needed; +1 centavo → required); closure blockers.

### Task 3: Endpoints (API §9.7)
`POST /work-orders` (from appointment or walk-in; captures `customerComplaint` freeform — Data Model §8.1); `GET /work-orders/:id`; `PATCH /:id/status`; `POST /:id/items` (part lookup or free-line, labour lines); `POST /:id/request-approval` → sets AWAITING_APPROVAL, notifies member (push arrives Phase 7; until then in-app + Socket.IO `workorder.approval_required`); `POST /:id/items/:itemId/decision { decision: APPROVED|DECLINED|DEFERRED }` (member-only, own vehicle; DEFERRED behaves as declined now but keeps `Recommendation.status = DEFERRED`); `POST /:id/waste`; `GET /recommendations?vehicleId=`; `GET /parts?query=`. Declined/deferred recommendations resurface at next inspection: inspection submission (Phase 4 hook) re-links unresolved `Recommendation`s and increments `resurfacedCount` (FR-069). **Tests:** e2e approval walk; per-line mixed decisions produce correct total; resurfacing across two inspections.

### Task 4: Advisor quote builder (W-05, W-06)
`/staff/work-orders/[id]`: header (vehicle plate chip, member, complaint, status pill timeline); item table — part search-as-you-type (SKU/name, shows stock), qty × price, discount per line, labour lines with hours; recommendations tray: open recommendations from the linked inspection one-click convert to lines (severity-colored, VHS detractor context shown); totals panel (parts/labour/discount/VAT); "Request approval" button with per-line preview of what the member will see. W-05 status controls advance the lifecycle with confirmations.
**Tests:** RTL — building the worked-example quote (front pads part + labour) matches expected totals.

### Task 5: Member approval flow (M-25, M-18, M-17)
M-25: approval request screen — each line: plain-language description (from recommendation, not SKU jargon, NFR-029), price, severity chip, photo evidence from the inspection finding, Approve / Decline / Defer per line; running approved-total; confirm sends decisions atomically; whole flow reachable from push (Phase 7) and in-app notification. M-18 recommendations list (open items with severity + estimated cost, deep-links into booking); M-17 service history (closed work orders: date, odometer, items, cost, technician summary — the permanent record). **Tests:** RTL decision flows; declined line → recommendation stays OPEN.

### Task 6: Parts & stock (FR-072)
Stock decrement transaction on closure (APPROVED PART lines); negative-stock override with reason (audit-logged); reorder-level flag surfaces in W-08 parts lookup (low-stock badge) and feeds A-10 margin report later (Phase 7 reads `costCentavos` vs `priceCentavos`). Admin CRUD for parts (behind ADMIN role, simple table UI in `/admin` or reuse staff W-08 with role gate). **Tests:** closure decrements exactly once (idempotent close); override path audited.

### Task 7: Waste capture (FR-074; F-10, W-09)
F-10 mechanic entry: waste type chips, quantity + unit (L, pcs), per work order — 56 dp targets, offline-queued like inspections (reuses Phase 4 outbox with `entityType: "waste_record"`). W-09 advisor review: per-WO waste list, edit before closure, hauler/manifest fields optional until disposal. Closure guard from Task 2 enforces capture. **Tests:** oil-change WO without USED_OIL record cannot close; offline waste record syncs.

### Task 8: Work-order billing hook
On closure with a billable balance (overage services, approved parts/labour): issue `Invoice { workOrderId }` through Phase 2's machinery (COD at counter via W-13 or e-payment intent from M-31). Member discount from plan tier applied at line level. **Tests:** closed WO → invoice math matches item table; settlement marks invoice PAID and leaves WO CLOSED.

## Exit criteria
- Full loop on simulator + web: inspection finding → recommendation → quote line → member approves on iOS → work proceeds → waste recorded → closed → service history entry + invoice settled.
- Threshold enforcement server-side proven (API test bypassing UI).
- Stock and waste accounting correct across the loop; declined items resurface at the next inspection.
