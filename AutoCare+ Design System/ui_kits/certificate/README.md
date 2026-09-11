# Public certificate UI kit (Next.js, server-rendered)

Recreation of the public Vehicle Health Certificate surface, built from `apps/web/app/(public)` in the source repo.

## Screens

| In this kit | Source screen | Source files |
|---|---|---|
| Certificate page | P-01 | `app/(public)/c/[token]/page.tsx`, `opengraph-image.tsx` |
| Verification form | P-02 | `app/(public)/verify/page.tsx` |
| Revoked / not-found notice | P-03 | `app/(public)/c/[token]/revoked.tsx` |

Switch between the three with the buttons at the top.

## Why this surface exists

A certificate link pasted into Facebook Marketplace or a Viber chat has to render server-side with an OpenGraph preview showing the score — a blank preview card destroys the trust signal the whole feature exists to create. This is also why the page is print-faithful: same gauge geometry, same band colours, no member contact data, `primary-deep` footer carrying the verification URL.

## Fidelity notes

The gauge here is 260px with a 22px stroke, matching the server-rendered SVG in the source rather than the 220/18 member-app default. Category rows use the `compact` CategoryBar to match the certificate's thinner 8px bars.
