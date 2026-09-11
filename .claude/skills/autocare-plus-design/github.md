repo: RielleTatel/autocare
branch: main
path:

## Last sync

date: 2026-09-10T00:00:00Z

### Updated in this project

- Rebuilt the token layer against `packages/design-tokens/src/tokens.ts` — Ignition Red #D9273F replaces the pre-rebrand Gauge Blue.
- Applied the client's September 2026 premium visual direction: rounded shape language and soft two-layer card elevation.
- Adopted the supplied R's Auto Care gear mark and wordmark lockup as the brand assets.
- Carried forward the full component inventory and all four UI kits from the in-repo design-system folder.

## Screen map

| Screen | Built from |
|---|---|
| `ui_kits/member-app/index.html` | `apps/member/src/features/{home,attention,health-score,booking,vehicles,subscription,work-orders}` |
| `ui_kits/field-app/index.html` | `apps/field/src` |
| `ui_kits/staff-web/index.html` | `apps/web/app` |
| `ui_kits/certificate/index.html` | `apps/web/app` (public certificate route) |
| `tokens/*.css` | `packages/design-tokens/src/tokens.ts`, `docs/design-system.html` |
| `components/**` | `apps/member/src/components`, `apps/field/src`, `autocare/AutoCare+ Design System/components` |
