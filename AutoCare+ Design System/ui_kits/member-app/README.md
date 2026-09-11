# Member app UI kit (React Native, iOS/Android)

Recreation of the AutoCare+ member app, built from `apps/member/src` in the source repo.

## Screens

| In this kit | Source screen | Source files |
|---|---|---|
| Home | M-10 Home dashboard | `features/home/HomeScreen.tsx`, `features/attention/AttentionCard.tsx` |
| Needs attention (full list) | M-38 | `features/attention/AttentionListScreen.tsx`, `AttentionItem.tsx` |
| Health Score | M-13 | `features/health-score/HealthScoreScreen.tsx`, `ScoreGauge.tsx`, `StarRating.tsx` |
| Category breakdown + explain sheet | M-14 / FR-115 | `features/health-score/CategoryBreakdownScreen.tsx`, `ExplainSheet.tsx` |
| My vehicles | M-11 | `features/vehicles/VehiclesListScreen.tsx` |
| Bookings list | M-23 | `features/booking/BookingsListScreen.tsx` |
| Work approval — per-line, running total | M-25 | `features/work-orders/ApprovalRequestScreen.tsx` |
| Account + plan change | M-28 / M-29 | `features/subscription/SubscriptionDashboardScreen.tsx`, `PlanSelectionScreen.tsx` |
| Booking flow — service, time, confirm | M-19, M-20, M-22 | `features/booking/ServiceTypeScreen.tsx`, `SlotPickerScreen.tsx`, `ConfirmScreen.tsx` |
| Roadside request + live status | M-26 / M-27 | screen inventory + SRS only — **not built in source** |
| Share certificate | M-16 | `features/health-score/ShareCertificateScreen.tsx` |

## What is interactive

Tab bar switches the four tabs. On Home: "See all" opens the attention list, the vehicle card opens the Health Score, "Book a service" starts the booking flow, and "Request" opens roadside. On Health Score: "See category breakdown" opens M-14, where any category opens the explain sheet and "Show components" expands the point rows; "Share" opens the certificate screen where the link can be revoked and regenerated. On Bookings: "Book new" starts the flow, Cancel flips an appointment to CANCELLED, and the work-order card opens the per-line approval screen with its running approved total. Roadside runs request → live status timeline.

The booking flow reproduces the source's real behaviour, including the FR-043 **slot hold**: picking a time acquires a 10-minute hold, the countdown ticks down ("Slot held — 9:43 left to confirm"), other times lock while it is live, and on expiry the danger-coloured re-pick prompt and "Refresh times" appear.

## Deviations from source, and why

- The source tab bar uses three tabs (Home, Vehicles, Profile) with emoji icons; the screen inventory specifies four (Home, My Vehicles, Bookings, Account). This kit follows the inventory and substitutes Lucide icons — see ICONOGRAPHY in the root readme.
- Roadside (M-26, M-27) is not implemented in the source repo. Its screens here are built from the screen inventory and the SRS requirements (FR-031 → FR-040) using the system's own patterns — treat them as a proposal, not a recreation.
- **Pick-up request (M-21) is in the screen inventory but has no implementation in the source repo, so the booking flow here is three steps, not four** — matching `BookingContainer`'s real path. An earlier draft of this kit invented a pick-up step; it was removed.
- Trip tracking (M-24) needs a live map and is represented by its entry point only.
- Content is illustrative but formatted to the product's rules: capped score with detractors, weight/points footnotes, peso amounts, EN/FIL band labels.
