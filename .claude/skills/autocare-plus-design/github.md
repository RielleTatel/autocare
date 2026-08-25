# Source repository

repo: RielleTatel/autocare
branch: main

## Last sync

date: 2026-08-25T00:00:00Z

### Updated in this project

- Built the token layer from `packages/design-tokens/src/tokens.ts` and the dark theme in `docs/design-system.html`.
- Authored 17 components across core, VHS, attention, field, shell and subscription groups, mirroring the source's component inventory.
- Built four UI kits: member app (deepest), field app, staff & admin web console, public VHS certificate.
- Added the client-supplied logo; flagged its amber against the protected FAIR band token.

## Screen map

| Project screen | Repo files |
|---|---|
| `ui_kits/member-app/` home + attention | `apps/member/src/features/home/HomeScreen.tsx`, `features/attention/AttentionCard.tsx`, `AttentionItem.tsx`, `AttentionListScreen.tsx` |
| `ui_kits/member-app/` health score + breakdown | `apps/member/src/features/health-score/ScoreGauge.tsx`, `StarRating.tsx`, `CategoryBreakdownScreen.tsx`, `ExplainSheet.tsx` |
| `ui_kits/member-app/` vehicles, account | `apps/member/src/features/vehicles/`, `features/subscription/PlanSelectionScreen.tsx`, `app/HomeTabs.tsx` |
| `ui_kits/member-app/` booking flow + bookings list | `apps/member/src/features/booking/ServiceTypeScreen.tsx`, `SlotPickerScreen.tsx`, `ConfirmScreen.tsx`, `BookingsListScreen.tsx` |
| `ui_kits/member-app/` work approval | `apps/member/src/features/work-orders/ApprovalRequestScreen.tsx` |
| `ui_kits/member-app/` roadside (M-26/27) | none — built from the screen inventory and SRS, not from source |
| `ui_kits/field-app/` | `apps/field/src/features/home/StaffHomeScreen.tsx`, `features/inspection/PointEntryScreen.tsx`, `CategoryNavScreen.tsx`, `ReviewSubmitScreen.tsx`, `ScoreResultScreen.tsx`, `shared/SyncBanner.tsx`, `theme/index.ts` |
| `ui_kits/staff-web/` | `apps/web/app/login/page.tsx`, `app/staff/schedule/Board.tsx`, `app/staff/page.tsx`, `app/admin/page.tsx`, `app/admin/UtilisationWidget.tsx`, `app/layout.tsx` |
| `ui_kits/certificate/` | `apps/web/app/(public)/c/[token]/page.tsx`, `revoked.tsx`, `app/(public)/verify/page.tsx` |
| `tokens/*.css` | `packages/design-tokens/src/tokens.ts`, `css-vars.ts`, `tailwind-preset.ts`, `docs/design-system.html` |
| `readme.md` foundations & voice | `docs/design-system.html`, `AutoCare+ Docs/03 Design/12 Screen Inventory.md`, `04 Client Handoff/18 Project Description.md` |
