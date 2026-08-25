# Staff web console UI kit (Next.js)

Recreation of the AutoCare+ web application, built from `apps/web/app` in the source repo.

## Screens

| In this kit | Source screen | Source files |
|---|---|---|
| Staff login | W-01 | `app/login/page.tsx` |
| Schedule board — day | W-02 / W-03 | `app/staff/schedule/Board.tsx`, `app/staff/schedule/page.tsx` |
| Work order detail + quote lines + approval | W-05 / W-06 / W-07 | `app/staff/work-orders/[id]`, `lib/scheduling/api` |
| Admin dashboard — KPIs, forward utilisation | A-01 | `app/admin/page.tsx`, `app/admin/UtilisationWidget.tsx` |
| Checklist / weight editor summary | A-04 / A-05 | `app/admin/checklists/page.tsx` |
| Waste log export | A-12 | screen inventory (not yet built in source) |

## What is interactive

Top-bar nav switches Schedule / Work orders / Admin. Sign out drops to the login card, which validates the email shape and shows the source's "Wrong email or password" error. On the schedule board, "Cancel" strikes the appointment through. On the work order, per-line Approve / Decline flips the state pill.

## Fidelity notes

The source console is deliberately sparse — several route groups exist as stubs (`/staff` is a two-link menu). Where the screen inventory specifies a dense counter view but the repo has no implementation yet, this kit builds the layout the inventory describes using the design system's own patterns, and says so here. The utilisation widget, status-pill mapping and board grouping are copied from the real components, including the 85% threshold line and the amber/red breach colours.
