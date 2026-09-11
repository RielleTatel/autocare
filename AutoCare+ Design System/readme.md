# AutoCare+ Design System

A design system for **AutoCare+**, a subscription car-care service in Zamboanga City, Philippines. Members pay monthly and get proactive care instead of reactive repair: scheduled inspections, maintenance reminders, pick-up and delivery, roadside assistance, and a Vehicle Health Score that turns "trust me, it's well maintained" into something a buyer can verify.

This system is a recreation and codification of the real product's design language. It was built by reading the source: the token package, the four client apps, and the project's own visual contract.

## Sources

| Source | Path / URL | What was taken from it |
|---|---|---|
| Codebase (attached, read-only) | `autocare/` — pnpm monorepo | All token values, component structure, screen inventory, copy |
| GitHub repository | https://github.com/RielleTatel/autocare | Same tree; see `github.md` for the sync record |
| Token package | `packages/design-tokens/src/tokens.ts` | Colours, band scale, font stacks, type scale, spacing, radii, targets — **the declared source of truth** |
| Visual contract | `docs/design-system.html` | Principles, dark theme, pill grammar, voice rules, gauge annotation |
| Member app | `apps/member/src` | ScoreGauge, StarRating, AttentionCard, ExplainSheet, PlanCard, CategoryBreakdown |
| Field app | `apps/field/src` | SyncBanner, StatusChoice, 56dp field scale |
| Web app | `apps/web/app` | StatusPill mapping, schedule board, utilisation widget, certificate page |
| Product docs vault | `AutoCare+ Docs/` | Screen inventory (92 v1.0 screens), VHS algorithm §11.5, project description |

Anyone extending this system should read those repositories directly — the source carries far more detail than any recreation can, especially the SRS and the VHS scoring algorithm.

**Logo.** The codebase contains no brand mark (`apps/member/assets/icon.png` is the unmodified Expo placeholder), but the client supplied one separately in August 2026 — **still subject to change**. Two files are in `assets/`:

- `logo-mark.png` — the arch mark on a rounded light tile. App icon, splash, in-app header.
- `logo-lockup.png` — mark plus "AutoCare+" wordmark. Certificates, print, anywhere the name must be readable at a distance.

Both are raster PNGs with a soft-shadowed rounded-square frame baked in, so they read as app icons rather than free-standing marks. **Ask for vector (SVG) and a transparent, frameless variant** before using the mark anywhere other than an icon slot. Where no mark fits, the wordmark **AutoCare+** set in Barlow Semi Condensed 600 remains the fallback.

**The logo's yellow is not a system colour.** The mark's road ribbon is a saturated amber around `#F5A623`. That is very close to the protected FAIR band token `#B87E00` — which in this product means "this vehicle is in fair condition". Using the logo yellow as a UI accent would make brand decoration indistinguishable from score data, which principle 1 forbids. The logo keeps its yellow; the interface does not adopt it. If the brand wants an amber accent in the UI, the band scale needs revisiting first.

## Four surfaces, one token set

| Surface | What changes | What never changes |
|---|---|---|
| Member app (React Native, iOS/Android) | System body font (SF Pro); four bottom tabs; the score gauge or the SOS button is the one bold element | Palette, band scale, spacing grid, radii, voice, pill grammar |
| Field app (React Native — mechanics, drivers) | Every type role ×1.125; 56dp targets; persistent sync banner; steppers, chips and camera over keyboards | ″ |
| Staff & admin web (Next.js) | Dense data tables, keyboard-first; Inter throughout; `primary-deep` top bar names the console | ″ |
| Public certificate (Next.js, SSR) | Print-faithful; gauge + band + verification code in mono; no member contact data; `primary-deep` footer | ″ |

---

## Principles

1. **Band colours are product data, not decoration.** The five VHS band colours appear only when they mean a score or an inspection status. Never as accents, never on a button, never behind a heading.
2. **One bold element per screen.** The score gauge, the SOS button, or the primary action — never all three shouting at once.
3. **Built for gloves and sunlight.** The field app raises every requirement one notch.
4. **Bilingual by design.** Every label ships in English and Filipino; layouts allow ~30% text expansion.
5. **The UI must answer "why?".** A score is never shown without its detractors; a component is never shown without a way to ask what it means.

## The core interaction

```
WHAT NEEDS ATTENTION  →  WHAT IS THE CONDITION?  →  WHICH COMPONENT?  →  WHAT ACTION?
   AttentionCard            ScoreGauge / bands        CategoryBar          Button / approval
```

Every major interface decision supports that chain. The home screen answers the first question in one card; the gauge and bands answer the second; the breakdown answers the third; the explain sheet and the approval action answer the fourth.

---

## CONTENT FUNDAMENTALS

**Voice: a competent mechanic explaining your car to you, in your own words.** Not a brand, not a chatbot, not a service desk.

**Person.** Second person for the member's things ("your vehicles are up to date", "your plan covers two inspections"). First-person plural only for what the business does on their behalf ("we'll collect the vehicle", "we'll re-check at the next inspection"). Never "I".

**Casing.** Sentence case everywhere — headings, buttons, card titles. The only upper case in the product is the mono status pill (`AWAITING APPROVAL`) and the uppercase field label (`NEXT BILLING DATE`). Never title case a heading.

**Plain verbs, no jargon.** The rule from the source visual contract:

> "brake pads worn", not "friction material below spec"

| Say | Not |
|---|---|
| Front brake pads are at 3.0 mm. Replace within 1,000 km. | Friction material below manufacturer specification. |
| Nothing needs attention right now. Your vehicles are up to date. | No records found (0 results). |
| This plate is already registered to another account. Check the number, or contact us if this is your vehicle. | Error: DUPLICATE_PLATE (409) |
| Book a service | Submit |
| 3 items waiting to sync | Offline mode active |

**Action names are stable through a flow.** "Approve work" leads to the toast "Work approved". A button never renames the thing it does.

**Errors name the recovery, never the code.** Every error message is a sentence that says what went wrong and what to do next. This is a requirement (NFR-032), not a preference.

**Empty states are stated positively and never hidden.** "Nothing needs attention right now" is the reassurance the attention feature exists to give; collapsing the card to nothing would remove it.

**Non-eligible states are non-punitive and offer the paid alternative.** A member out of roadside call-outs is told the price of another, not told no.

**Numbers.** Tabular figures everywhere. Odometers with thousands separators and a `km` suffix. Money in pesos with the `₱` sign and thousands separators (`₱1,499`). Measurements with a space before the unit (`3.0 mm`, `12.3 V`). Scores are integers 0–100; category scores round to one decimal internally and display rounded.

**Bilingual.** English leads; the Filipino label sits beneath at label size in muted ink. Band labels are fixed pairs: Excellent/Napakaayos, Good/Maayos, Fair/Katamtaman, Needs Attention/Kailangan ng Aksyon, Critical/Delikado. Filipino is reviewed and shipped with English, never machine-translated later (NFR-029).

**Emoji.** The source React Native code uses emoji as stand-in icons (🏠 🚗 👤 🔧 📷 ⇅) because no icon assets were ever added. **Do not carry this into new work** — emoji are not part of the brand. See ICONOGRAPHY.

---

## VISUAL FOUNDATIONS

### Colour

Cool steel neutrals — a workshop, not a café. `chassis` (#EEF1F3) is the app background and is *never* a warm grey or cream. `surface` is pure white. One brand colour, **Gauge Blue** `#0E5AA7`, carries every action, link and focus ring; `primary-deep` `#0A2E4F` is chrome — mastheads, the field sync banner, the certificate footer.

Semantic action colours (`danger` #C2372C, `success` #177245) are deliberately *different tokens* from the band scale, so a red delete button can never be confused with a critical score.

The band scale is protected: `#177245` `#5C9E31` `#B87E00` `#C75E1B` `#B3261E`. Fills pass 3:1 with white text, stay distinguishable under common colour-vision deficiencies, and are identical across iOS, web and the printed certificate PDF. Changing them requires a design review. Contrast is unit-tested in CI (4.5:1 body, 3:1 large text — NFR-028).

Dark theme shifts the neutrals only. Band fills never change.

**Known source drift:** `tokens.ts` sets FAIR to `#B87E00` while `docs/design-system.html` shows `#C88A00`. This system follows `tokens.ts`, which the package header declares the source of truth. Worth reconciling upstream.

### Type

Three faces, three jobs. **Barlow Semi Condensed 600** — road-signage DNA — for every heading and the score numeral. **Inter** for UI text (native apps substitute the system stack, SF Pro on iOS). **IBM Plex Mono 500** for machine identity only: plates, VINs, verification codes, status pills, clock columns in the schedule board.

Hierarchy comes from the type scale, not from colour or borders. Six roles: score 72, h1 28, h2 22, body 16/1.6, label 13 uppercase +0.03em, code 15 +0.1em. The field app multiplies all six by 1.125. Technical values are visually distinct from explanatory prose — that is the whole reason mono exists in this system.

### Space, shape, elevation

4-pt grid: 4 / 8 / 16 / 24 / 32 / 48. Screen gutters 16. Card padding 16 on mobile, 24 on web. 8 between siblings, 24 between sections. Radii: 6 for controls, 12 for cards and sheets, full for pills and progress bars — and nothing else.

**Elevation is the hairline.** A card is `1px solid #D5DBE0` on white over the chassis grey; that contrast alone carries the plane. No shadow on cards. Shadow appears in exactly two places: the web login card (a light 1px/3px pair) and bottom sheets over the `rgba(22,35,46,0.4)` scrim.

Status accents are structural, not decorative: a 5px left edge on attention rows, a 4px left edge on the home card's top item. The one place a coloured left border is legitimate in this system is severity, and it always ships with the severity word.

### Backgrounds and imagery

There are none. No hero photography, no illustration, no gradients, no patterns, no textures, no glass. Every surface is a flat token colour. The only photographs in the product are **finding photos** taken by mechanics — evidence, shown at radius 6, `object-fit: cover`, never treated or tinted. If a screen feels empty, the answer is fewer elements, not a background.

### Motion

Motion communicates state change, hierarchy and navigation. Nothing else moves.

- Press: opacity to 0.82 over 90ms
- Status or selection colour change: 140ms `cubic-bezier(.2,0,.2,1)`
- Bars and gauge arcs grow from their origin: 220ms
- Bottom sheets slide up from the bottom edge: 280ms `cubic-bezier(0,0,.2,1)`
- Nothing bounces, springs, loops, pulses or shimmers
- `prefers-reduced-motion` zeroes every duration

### States

- **Hover** (web only): primary buttons darken to `#0C4E90`; cards and rows do not lift or shadow — the pointer changes and nothing else
- **Press**: opacity 0.82, no scale
- **Focus**: 3px `--ac-primary` outline, 2px offset — visible on every interactive element, never removed
- **Selected**: filled in the meaningful colour (band fill for a status choice, `primary` border 1.5px for a plan card)
- **Disabled**: `--ac-line` background, `--ac-ink-muted` label, `not-allowed` cursor — never a faded primary colour
- **Locked** (field app, measured points): opacity 0.4, so the mechanic can see the threshold doing its work

### Layout rules

Fixed elements: the member tab bar (bottom, 56px), the field sync banner (top, unconditional), the web console top bar (56px, `primary-deep`). Everything else scrolls. Bottom sheets are anchored to the bottom edge, never centred. The web console content column caps at 1280px.

### Transparency and blur

Blur is never used. Transparency appears in exactly three places: the sheet scrim (40% ink), status pill tints (`color-mix` 12–14% of the semantic colour), and the disabled/locked opacities. No frosted panels, no translucent chrome.

---

## ICONOGRAPHY

**The AutoCare+ codebase ships no icon assets.** There is no icon font, no SVG sprite, no icon directory in any of the four apps. The React Native code renders emoji inline as placeholders — `🏠 🚗 👤` in the member tab bar, `🔧` and `⇅` on field action buttons, `📷` on the required-photo button — and the web console uses text characters (`›`, `▲`, `▼`) for affordances. The only image assets are `apps/member/assets/*.png`, which are the unmodified Expo template icons.

**Substitution, flagged:** this system uses **[Lucide](https://lucide.dev)** from CDN (`lucide-static@0.544.0`), wrapped in the `Icon` component. Lucide's 2px stroke, square-cap, geometric construction is the closest widely-available match to the operational/industrial register the design language calls for, and it has the mechanical vocabulary the product needs (`wrench`, `gauge`, `car-front`, `truck`, `battery`). It is a substitution, not the brand's set — **please confirm or replace it.**

Rules for icon use here:

- Icons are **always decorative** (`aria-hidden`) and always sit beside their own text label. An icon is never the only signal for a status — the status word carries it.
- Sizes: 16 inline, 20 default, 22 tab bar, 24 card leading. Field app: one step up.
- Icons take `currentColor` and inherit the text colour beside them; a band-coloured icon is only legitimate when it sits inside a score context.
- **No emoji in new work.** The emoji in the source are placeholders for missing assets, not a brand decision.
- No hand-drawn SVG. If a needed glyph isn't in Lucide, ask rather than draw.

---

## Index

| File | What it is |
|---|---|
| `styles.css` | The one stylesheet consumers link. `@import` list only. |
| `tokens/colors.css` | Palette, band scale, severity aliases, dark theme, semantic aliases |
| `tokens/typography.css` | Font stacks, six-role type scale, tracking |
| `tokens/spacing.css` | 4-pt scale, radii, touch targets, border widths |
| `tokens/elevation.css` | Hairline / raised / sheet elevation, scrim |
| `tokens/motion.css` | Durations, easings, press opacity |
| `tokens/fonts.css` | Google Fonts import for the three faces |
| `thumbnail.html` | Homepage tile |
| `assets/logo-mark.png`, `assets/logo-lockup.png` | Supplied brand mark and lockup (raster, framed) |
| `guidelines/*.card.html` | 19 foundation specimen cards (Colors, Type, Spacing, Brand) |
| `github.md` | Source repository association and sync record |
| `SKILL.md` | Agent Skills entry point |

### Components

Grouped by concern. Every directory has a `@dsCard` HTML showing its states.

**`components/core/`** — `Button`, `Card`, `StatusPill`, `Plate`, `FormField`, `EmptyState`, `Icon`

**`components/vhs/`** — `ScoreGauge`, `StarRating`, `BandChip`, `CategoryBar`

**`components/attention/`** — `AttentionCard`, `AttentionItemRow`

**`components/field/`** — `SyncBanner`, `StatusChoice` (with `StatusChip`)

**`components/shell/`** — `TabBar`, `BottomSheet` (with `MeasuredRow`)

**`components/subscription/`** — `PlanCard`

The inventory comes from the source: every component above has a counterpart in `apps/member`, `apps/field` or `apps/web`. No speculative primitives were added.

**Intentional additions**

- `Icon` — a wrapper for the substituted Lucide set. The source has no icon component because it has no icons; new work needs one.
- `EmptyState` — the source renders empty, loading and error states inline in each screen with identical structure. Extracting it makes the shared shape enforceable.
- `BandChip`, `MeasuredRow`, `StatusChip` — extracted from repeated inline markup in `ScoreGauge`, `ExplainSheet` and `PointEntryScreen` respectively.

### UI kits

| Kit | Product surface |
|---|---|
| `ui_kits/member-app/` | Member app — home, attention list, health score, breakdown + explain sheet, vehicles, bookings, account |
| `ui_kits/field-app/` | Field app — task list, category navigator, point entry, review, score result, sync queue |
| `ui_kits/staff-web/` | Staff & admin console — login, schedule board, work order, admin dashboard |
| `ui_kits/certificate/` | Public VHS certificate, verification form, revoked notice |

Each kit has its own README mapping screens to source files and listing what was deliberately not built.

No slide template was provided, so no sample slides were created.
