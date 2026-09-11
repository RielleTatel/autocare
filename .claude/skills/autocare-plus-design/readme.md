# AutoCare+ Design System

A design system for **AutoCare+**, the subscription car-care product operated by **R's Auto Care Services** in Zamboanga City, Philippines. Members pay monthly and get proactive care instead of reactive repair: scheduled inspections, maintenance reminders, pick-up and delivery, roadside assistance, and a **Vehicle Health Score (VHS)** that turns "trust me, it's well maintained" into something a buyer can verify.

This system is a recreation and codification of the real product's design language, rebuilt in September 2026 against the client's supplied brand mark and a new premium visual direction.

## Sources

| Source | Path / URL | What was taken from it |
|---|---|---|
| Codebase (attached, read-only) | `autocare/` — pnpm monorepo | Token values, component inventory, screen structure, product copy |
| GitHub repository | https://github.com/RielleTatel/autocare | Same tree; see `github.md` |
| Token package | `packages/design-tokens/src/tokens.ts` | Colours, band scale, font stacks, type scale, spacing, targets — **the declared source of truth** |
| Prior design system | `autocare/AutoCare+ Design System/` | Component implementations, UI kits and prose, carried forward and re-skinned |
| Member app | `apps/member/src` | ScoreGauge, StarRating, AttentionCard, ExplainSheet, PlanCard, CategoryBreakdown, TabBar |
| Field app | `apps/field/src` | SyncBanner, StatusChoice, 56dp field scale |
| Web app | `apps/web/app` | StatusPill mapping, schedule board, utilisation widget, certificate page |
| Product docs vault | `AutoCare+ Docs/` | Screen inventory (92 v1.0 screens), VHS algorithm §11.5, project description |
| Client uploads | `assets/logo-mark.png`, `assets/logo-lockup.png`, `assets/reference-visual-direction.webp` | Brand mark, lockup, and the premium-automotive visual reference |

Anyone extending this system should read those repositories directly — the source carries far more detail than any recreation can, especially the SRS and the VHS scoring algorithm. Browsing https://github.com/RielleTatel/autocare will let you build far more accurate AutoCare+ designs than this system alone.

## The brand mark

Two raster PNGs were supplied by the client, both transparent:

- `assets/logo-mark.png` — a gear ring enclosing an **R**, red with an ember-orange lower arc. App icon, splash, in-app masthead.
- `assets/logo-lockup.png` — the "R's Auto Care Services" wordmark. Certificates, print, anywhere the name must read at a distance.

**No vector artwork was supplied.** Ask for SVG before using the mark above about 200 px, and before any print or embroidery use. Where no mark fits, the wordmark **AutoCare+** set in Barlow Semi Condensed 600 — with the plus in Ignition Red — is the fallback.

**The mark's ember orange is not a UI accent.** `--ac-ember` (#EE8034) exists so brand surfaces can reproduce the logo faithfully. It sits close to the FAIR band token #B87E00, which in this product means "this vehicle is in fair condition"; using it as decoration would make brand colour indistinguishable from score data, which principle 1 forbids.

## Four surfaces, one token set

| Surface | What changes | What never changes |
|---|---|---|
| Member app (React Native, iOS/Android) | System body font (SF Pro); four bottom tabs; the score gauge or the SOS button is the one bold element | Palette, band scale, spacing grid, radii, voice, pill grammar |
| Field app (React Native — mechanics, drivers) | Every type role ×1.125; 56dp targets; persistent sync banner; steppers, chips and camera over keyboards | ″ |
| Staff & admin web (Next.js) | Dense data tables, keyboard-first; `Card flat` and hairlines instead of soft elevation | ″ |
| Public certificate (Next.js, SSR) | Print-faithful; gauge + band + verification code in mono; no member contact data | ″ |

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

## What departs from tokens.ts

`packages/design-tokens/src/tokens.ts` declares itself the source of truth, and this system follows it on **colour, the band scale, the type scale, the spacing grid and touch targets** — verbatim. Two things depart, both on the client's September 2026 visual direction (`assets/reference-visual-direction.webp`):

| Concern | Shipped | Here | Why |
|---|---|---|---|
| Radii | 6 / 12 / 999 | 8 / 12 / 20 / 28 / 36 / 999 | The direction asks for a strongly rounded shape language throughout |
| Elevation | Hairline only; shadow on two screens | Two-layer soft shadow on cards; hairline retained as `Card flat` | Cards should read as premium objects on a studio surface |

Shipped radii remain available as `--ac-radius-legacy-sm` and `--ac-radius-legacy-md`. **If the product team wants this system to stay byte-identical to `tokens.ts`, say so and both revert in one edit.**

**Known source drift:** `tokens.ts` sets FAIR to `#B87E00` while `docs/design-system.html` shows `#C88A00`, and the older design-system folder still carries the pre-rebrand Gauge Blue `#0E5AA7` as `--ac-primary`. This system follows `tokens.ts` (`#D9273F` Ignition Red, `#B87E00` FAIR). Worth reconciling upstream.

---

## CONTENT FUNDAMENTALS

**Voice: a competent mechanic explaining your car to you, in your own words.** Not a brand, not a chatbot, not a service desk.

**Person.** Second person for the member's things ("your vehicles are up to date", "your plan covers two inspections"). First-person plural only for what the business does on their behalf ("we'll collect the vehicle", "we'll re-check at the next inspection"). Never "I".

**Casing.** Sentence case everywhere — headings, buttons, card titles. The only upper case in the product is the mono status pill (`AWAITING APPROVAL`) and the uppercase field label (`NEXT BILLING DATE`). Never title case a heading.

**Plain verbs, no jargon.** The rule from the source visual contract: "brake pads worn", not "friction material below spec".

| Say | Not |
|---|---|
| Front brake pads are at 3.0 mm. Replace within 1,000 km. | Friction material below manufacturer specification. |
| Nothing needs attention right now. Your vehicles are up to date. | No records found (0 results). |
| This plate is already registered to another account. Check the number, or contact us if this is your vehicle. | Error: DUPLICATE_PLATE (409) |
| Book a service | Submit |
| 3 items waiting to sync | Offline mode active |

**Action names are stable through a flow.** "Approve work" leads to the toast "Work approved". A button never renames the thing it does.

**Errors name the recovery, never the code.** Every error message says what went wrong and what to do next. This is a requirement (NFR-032), not a preference.

**Empty states are stated positively and never hidden.** "Nothing needs attention right now" is the reassurance the attention feature exists to give; collapsing the card to nothing would remove it.

**Non-eligible states are non-punitive and offer the paid alternative.** A member out of roadside call-outs is told the price of another, not told no.

**Numbers.** Tabular figures everywhere. Odometers with thousands separators and a `km` suffix. Money in pesos with the `₱` sign and thousands separators (`₱1,499`). Measurements with a space before the unit (`3.0 mm`, `12.3 V`). Scores are integers 0–100.

**Bilingual.** English leads; the Filipino label sits beneath at label size in muted ink. Band labels are fixed pairs: Excellent/Napakaayos, Good/Maayos, Fair/Katamtaman, Needs Attention/Kailangan ng Aksyon, Critical/Delikado. Filipino is reviewed and shipped with English, never machine-translated later (NFR-029).

**Emoji.** The source React Native code uses emoji as stand-in icons (🏠 🚗 👤 🔧 📷 ⇅) because no icon assets were ever added. **Do not carry this into new work** — emoji are not part of the brand. See ICONOGRAPHY.

---

## VISUAL FOUNDATIONS

### Colour

Cool steel neutrals over a light studio ground. `--ac-chassis` #EEF1F3 is the app background — never a warm grey or cream. `--ac-surface` is pure white; `--ac-surface-soft` #F7F8FA is the inset field and tile fill.

One brand colour, **Ignition Red** `#D9273F`, carries every action, link, focus ring and active tab. `--ac-primary-deep` `#6B0F22` is chrome — mastheads, the field sync banner, the certificate footer, the plate chip. Red is used sparingly and always means "act here": it is never a background wash, never a heading colour.

Semantic action colours (`danger` #C2372C, `success` #177245) are deliberately *different tokens* from the band scale, so a red delete button can never be confused with a critical score. Note danger and primary are both reds; danger is the browner, desaturated one and appears only on destructive confirmations and the roadside SOS.

The band scale is protected: `#177245` `#5C9E31` `#B87E00` `#C75E1B` `#B3261E`. Fills pass 3:1 with white text, stay distinguishable under common colour-vision deficiencies, and are identical across iOS, web and the printed certificate PDF. `-soft` tints of each exist for large status surfaces; the band word always ships with the colour. Contrast is unit-tested in CI (4.5:1 body, 3:1 large text — NFR-028).

Dark theme shifts the neutrals only. Band fills never change.

### Type

Three faces, three jobs. **Barlow Semi Condensed 600** — road-signage DNA — for every heading, the score numeral and the oversized editorial line the new direction introduces. **Inter** for UI text (native apps substitute the system stack, SF Pro on iOS). **IBM Plex Mono 500** for machine identity only: plates, VINs, verification codes, status pills, clock columns in the schedule board.

Hierarchy comes from the type scale, not from colour or borders. Seven roles: score 72, display 40, h1 28, h2 22, body 16/1.6, label 13 uppercase +0.03em, code 15 +0.1em. The field app multiplies all seven by 1.125. Headline tracking is negative (-0.015em) at display and score sizes; positive tracking is reserved for labels and mono.

Technical values are visually distinct from explanatory prose — that is the whole reason mono exists in this system.

### Space, shape, elevation

4-pt grid: 4 / 8 / 16 / 24 / 32 / 48. Screen gutters 24 (up from 16 — the direction asks for more air). Card padding 20–24 on mobile, 24 on web. 8 between siblings, 24 between sections.

Radii: 8 chips, 12 controls and inputs, 20 the default card, 28 major cards and bottom sheets, 36 hero surfaces, full for pills and progress bars — and nothing else. Buttons are pills.

**Elevation is a two-layer shadow over a soft border.** `--ac-elevation-card` is a 1px/2px contact shadow plus an 8px/24px ambient one at 4–5% ink, on a `--ac-line-soft` #E7EBEE border rather than the full-strength steel hairline. `--ac-elevation-raised` is the selected/modal step. Dense data surfaces — the staff console tables, the certificate — keep `Card flat`: no shadow, full hairline. Bottom sheets carry `--ac-elevation-sheet` over an `rgba(22,35,46,0.4)` scrim.

Status accents are structural, not decorative: a 5px left edge on attention rows, a 4px left edge on the home card's top item. The one place a coloured left border is legitimate in this system is severity, and it always ships with the severity word.

### Backgrounds and imagery

The shipped product has none: no hero photography, no illustration, no gradients, no patterns, no textures, no glass. Every surface is a flat token colour.

The September 2026 direction changes this in one specific way and no other: **vehicle imagery becomes a compositional anchor on vehicle-identity surfaces** — the home overview card, vehicle details, the certificate header. A studio-lit vehicle cutout on a light ground, allowed to extend past the card's boundary, with the display-size vehicle name as the counterweight. This is the one place the system spends visual budget on an image.

**No vehicle photography exists yet.** None ships in the codebase and none was supplied. Until real renders arrive, vehicle-identity surfaces render the plate chip and display-size name alone; the UI kits leave the image slot empty rather than fake it. The only photographs in the product today are **finding photos** taken by mechanics — evidence, shown at radius 8, `object-fit: cover`, never treated or tinted.

Gradients, glass and blur remain out. "Soft" here means soft shadow and generous radius, not translucency.

### Motion

Motion communicates state change, hierarchy and navigation. Nothing else moves.

- Press: opacity to 0.82 over 90ms
- Status or selection colour change: 140ms `cubic-bezier(.2,0,.2,1)`
- Bars and gauge arcs grow from their origin: 220ms
- Bottom sheets slide up from the bottom edge: 280ms `cubic-bezier(0,0,.2,1)`
- Nothing bounces, springs, loops, pulses or shimmers
- `prefers-reduced-motion` zeroes every duration

### States

- **Hover** (web only): primary buttons darken to `#C21F36`; cards and rows do not lift, and the shadow does not grow — the pointer changes and nothing else
- **Press**: opacity 0.82, no scale. Primary buttons go to `#A81A2E`
- **Focus**: 3px `--ac-primary` outline, 2px offset — visible on every interactive element, never removed
- **Selected**: filled in the meaningful colour (band fill for a status choice, `primary` 1.5px border plus `--ac-elevation-raised` for a plan card)
- **Disabled**: `--ac-line` background, `--ac-ink-muted` label, `not-allowed` cursor — never a faded primary colour
- **Locked** (field app, measured points): opacity 0.4, so the mechanic can see the threshold doing its work

### Layout rules

Fixed elements: the member tab bar (bottom, 56px, white with `--ac-elevation-nav`), the field sync banner (top, unconditional), the web console top bar (56px, `primary-deep`). Everything else scrolls. Bottom sheets are anchored to the bottom edge, never centred. The web console content column caps at 1280px.

### Transparency and blur

Blur is never used. Transparency appears in exactly three places: the sheet scrim (40% ink), status pill tints (`color-mix` 12–14% of the semantic colour), and the disabled/locked opacities. No frosted panels, no translucent chrome.

---

## ICONOGRAPHY

**The AutoCare+ codebase ships no icon assets.** There is no icon font, no SVG sprite, no icon directory in any of the four apps. The React Native code renders emoji inline as placeholders — `🏠 🚗 👤` in the member tab bar, `🔧` and `⇅` on field action buttons, `📷` on the required-photo button — and the web console uses text characters (`›`, `▲`, `▼`) for affordances. The only image assets are the two client logo PNGs and `apps/member/assets/*.png`, which are Expo template leftovers.

**Substitution, flagged:** this system uses **[Lucide](https://lucide.dev)** from CDN (`lucide-static@0.544.0`), wrapped in the `Icon` component and recoloured via CSS mask so every glyph takes `currentColor`. Lucide's 2px stroke, square-cap, geometric construction is the closest widely-available match to the operational register the design language calls for, and it has the mechanical vocabulary the product needs (`wrench`, `gauge`, `car-front`, `battery`, `disc`, `droplet`). It is a substitution, not the brand's set — **please confirm or replace it.**

Rules for icon use here:

- Icons are **always decorative** (`aria-hidden`) and always sit beside their own text label. An icon is never the only signal for a status — the status word carries it.
- Sizes: 16 inline, 20 default, 22 tab bar, 24 card leading. Field app: one step up.
- Icons inherit the text colour beside them; a band-coloured icon is only legitimate inside a score context.
- **No emoji in new work.** The emoji in the source are placeholders for missing assets, not a brand decision.
- No hand-drawn SVG. If a needed glyph isn't in Lucide, ask rather than draw.

---

## Index

| File | What it is |
|---|---|
| `styles.css` | The one stylesheet consumers link. `@import` list only. |
| `tokens/colors.css` | Palette, band scale, soft tints, severity aliases, dark theme, semantic aliases |
| `tokens/typography.css` | Font stacks, seven-role type scale, tracking |
| `tokens/spacing.css` | 4-pt scale, radii, touch targets, border widths |
| `tokens/elevation.css` | Soft card / raised / nav / sheet elevation, scrim |
| `tokens/motion.css` | Durations, easings, press opacity |
| `tokens/fonts.css` | Google Fonts import for the three faces |
| `thumbnail.html` | Homepage tile |
| `assets/logo-mark.png`, `assets/logo-lockup.png` | Supplied brand mark and lockup (raster, transparent) |
| `assets/reference-visual-direction.webp` | The client's premium-automotive visual reference |
| `guidelines/*.card.html` | 21 foundation specimen cards (Colors, Type, Spacing, Motion, Brand) |
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
| `ui_kits/member-app/` | Member app — home, attention list, health score, breakdown + explain sheet, vehicles, bookings, roadside, account |
| `ui_kits/field-app/` | Field app — task list, category navigator, point entry, review, score result, sync queue |
| `ui_kits/staff-web/` | Staff & admin console — login, schedule board, work order, admin dashboard |
| `ui_kits/certificate/` | Public VHS certificate, verification form, revoked notice |

Each kit has its own README mapping screens to source files and listing what was deliberately not built.

No slide template was provided, so no sample slides were created.
