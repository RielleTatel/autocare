# Sprint 5 staff web API seams

The UI uses the same-origin `/api/proxy/` BFF, which forwards to `/api/v1/` and attaches the sealed staff session. Responses use `{success:true,data:...}` or `{success:false,error:{code,message,details?}}`. Validation `details.problems` is shown as readable text. Missing endpoints and rejected requests remain errors; the UI does not simulate successful operations.

This document records the implemented web expectations. Source alignment and TypeScript checking are not connected browser/API acceptance. No tests were run for this UI task.

## Services and templates

`/admin/services` and `/admin/inspection-templates` are ADMIN routes.

| Method and API route | Request | Expected response data |
| --- | --- | --- |
| `GET /admin/inspection-templates` | — | Template array; version summaries |
| `GET /admin/inspection-templates/:templateId` | — | Template; each version includes `categories` |
| `POST /admin/inspection-templates` | `{name,scope:"FULL"\|"FOCUSED"}` | Created Template |
| `POST /admin/inspection-templates/:templateId/versions` | `{}` or `{sourceVersionId}` | Updated Template containing a draft version |
| `PATCH /admin/inspection-templates/:templateId/versions/:versionId` | `{categories:EditorCategory[]}` | Updated Template |
| `POST /admin/inspection-templates/:templateId/versions/:versionId/publish` | No body | Updated Template |
| `GET /scheduling/service-types` | — | Service array with price, skills, inspection flag and `inspectionTemplateVersionId` |
| `POST /scheduling/service-types` | `{code,name,standardDurationMin,requiredSkills,priceCentavos,inspectionRequired,inspectionTemplateVersionId}` | Created service |
| `PATCH /scheduling/service-types/:id` | Same edited fields | Updated service |

Template shape: `{id,name,scope,isActive,versions:[{id,versionLabel,status,publishedAt,categories?}]}`. Categories and checks use the existing checklist definition shape, including stable logical `code`, English/Filipino labels, weights, answer type, units, thresholds, recommendations, result guidance and applicability. A version’s categories can also be read through existing `GET /admin/checklists/:versionId`. The editor copies selected logical checks across categories; it never changes a published version.

The server must validate immutable published definitions, valid logical references, scoring definitions and genuine full scope. Publishing a focused template must preserve the designated full baseline. Service selection includes only published versions of active templates. An inspection-required service with no valid assignment is shown as needing configuration.

## Admin review and final issue

`/admin/reviews` lists reviewable completed services and completed/stopped repairs. `/admin/reviews/:appointmentId` displays work, original service coverage, estimate and final repair amount.

| Method and API route | Request | Expected response data |
| --- | --- | --- |
| `GET /admin/final-billing/reviews` | — | Review array |
| `GET /admin/final-billing/reviews/:appointmentId` | — | Review |
| `POST /admin/final-billing/reviews/:appointmentId/return` | `{expectedVersion,reason}` | Updated Review |
| `POST /admin/final-billing/reviews/:appointmentId/issue` | `{expectedVersion,finalRepairCentavos?}` | Updated Review; UI re-reads authoritative detail |

Review shape:

```ts
{
  appointmentId: string; version: number; vehicleId: string; vehiclePlateNo: string;
  status: string; invoiceId: string | null;
  service: {
    name: string; priceCentavos: number; covered: boolean;
    chargeCentavos: number; alreadyBilled: boolean; previousInvoiceId: string | null;
  };
  repair: null | {
    id: string; notes: string; estimatedTotalCentavos: number;
    completedWorkNotes: string | null; completionNotes: string | null;
    outcome: string; rechecked: boolean; finalRepairCentavos: number | null;
  };
  history: Array<{action: string; actorName: string | null; at: string; notes: string | null}>;
}
```

The server enforces ADMIN-only return/issue, eligibility and version guards, one original-service allocation and one immutable final bill. It computes service coverage and already-billed allocation. The UI never records customer consent or line-item repair approval. A zero total issues a durable `documentKind:"NO_CHARGE"`, without payment.

The existing staff work-order detail recognizes `simpleRepair:true` and shows only repair notes/progress/estimate/final amount, with authorized review/bill links. It expects `appointmentId`, `repairStatus`, `repairNotes`, `estimatedRepairCentavos`, `finalRepairCentavos`, `repairRechecked`, `repairCompletionNotes`, `completedWorkNotes`, `repairStopReason`, `repairReviewReason` and `invoiceId`. Structured work orders retain their legacy interface.

## Cash bills and documents

`/staff/billing` and its detail route allow ADMIN and ADVISOR only. The BFF forwards the `Idempotency-Key` header.

| Method and API route | Request | Expected response data |
| --- | --- | --- |
| `GET /invoices?scope=workshop` | — | Authorized service/repair final bills, excluding unrelated subscription checkout |
| `GET /invoices/:id` | — | Final bill detail with existing `items` |
| `GET /invoices/:id/pdf` | — | `{url}` for unpaid bill, paid receipt or No charge document |
| `GET /cash-shifts/current` | — | Collector’s own open CashShift, or `null` |
| `POST /cash-shifts/open` | No body | Own open CashShift |
| `POST /cash-shifts/:id/close` | `{countedCentavos}` | Closed CashShift with expected/count/variance |
| `POST /payments/cash` | `{invoiceId,amountTendered,clientUuid}` and `Idempotency-Key: clientUuid` | `{paymentId,changeCentavos}` |

Final bills carry `id,number,appointmentId,workOrderId,subscriptionId,vehicleId,plateNo,serviceName,documentKind,totalCentavos,status,dueDate,issuedAt`, plus detail `items:[{id,description,qty,unitPriceCentavos,taxCentavos}]` and `payment:null|{method,status,tenderedCentavos,changeCentavos}`. No charge is determined by `documentKind`, not by pretending a zero-value CASH payment exists.

CashShift shape is the existing `{id,userId,openedAt,closedAt,expectedCentavos,countedCentavos,varianceCentavos}`. Money uses integer centavos. Full settlement, own-open-shift policy, collector authorization and replay/concurrency protection remain server rules. Cash attempts retain the exact UUID and tender locally by collector and invoice; an uncertain response triggers the same invoice read before retry. This is recovery of an explicit online action, not an offline payment queue. Receipt wording depends on actual succeeded CASH payment data. PDF storage must not keep a previously rendered unpaid document after payment.
