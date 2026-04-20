# Current Feature: 13 UX Polish — Onboarding, Copy, Control Layout

## Status

In Progress

## Goals

### Info button + About sheet
- New `AboutSheet` component on shadcn `Sheet` (same primitive as 08); opens right, `modal={false}`, Esc + close-button dismiss
- New Info icon button in overlay top-right, immediately left of the theme toggle; same ghost-button styling; lucide `Info`; `aria-label="About this map"`
- Sheet content (~5 paragraphs):
  - Headline: "Metro Vancouver Frequent Transit Map"
  - One-sentence concept
  - One-sentence rider-grounded payoff
  - ≤4-item "how to use" list
  - FTN explainer (spell out acronym + paraphrase TransLink rule)
  - Footer: data source, GitHub link, SPEC.md link
- **No auto-open on first visit** — the button itself is the affordance

### Label rewrites
- `ThresholdSlider`: `THRESHOLDS` → `HOW OFTEN IS "FREQUENT"?` + muted subtitle `Drag to customize.`
- `ModeFilter`: `MODE` → `SHOW`
- `FrequencyControls`: `DAY TYPE` → `WHICH DAY`; `TIME WINDOW` → `TIME OF DAY`
- Preserve existing heading semantics / uppercase tracking — we're swapping *words*, not redesigning

### Legend band phrasing
- `≤ 10 min` → `Very frequent — every 10 min or better`
- `≤ 15 min (FTN)` → `Frequent — every 15 min (FTN)`
- `≤ 30 min` → `Standard — every 30 min or better`
- `> 30 min` → `Infrequent — every 30+ min`
- `Peak only` → `Peak only (rush hour)`
- `Night only` → `Night only (overnight)`
- `No service` → `No service at this time`
- Constraint: longest row must still fit 14rem; verify in both themes
- Slider-tick labels stay terse (context is implicit next to numbers)

### FTN acronym
- Spelled out in About sheet's explainer paragraph
- Route panel already says "Frequent Transit Network" in its section header — no change
- Legend row keeps the compact `(FTN)` suffix

### Accessibility
- Info button `aria-label="About this map"`; sheet `aria-labelledby` points at sheet title
- Label changes preserve existing heading semantics
- `modal={false}` + explicit autofocus pattern from 08 preserved

## Notes

- Depends on: **04–09** (surface area the sheet describes), **08** (Sheet primitive + `modal={false}` pattern), **12** (theme-aware surfaces from the start)
- **Why a side sheet not a dialog?** Route detail panel trained users to expect right-side content; reuse the affordance
- **Why no auto-open?** localStorage first-run banners nag returning users + get dismissed unread; a visible button is the cleanest equivalent
- **Why not "Show up and go"?** Mixes registers with "Peak only" / "Night only" which stay descriptive; keep vocabulary consistent
- Out of scope: auto-opening on first visit, full onboarding tour (Shepherd/Driver), contextual tooltips on every panel, curated example routes, progressive disclosure of power controls, rewriting band *names*
- **Commit plan**:
  1. `feat: add About info button and onboarding side sheet`
  2. `feat: rider-friendly labels on controls and legend`
  3. (optional) `docs: README screenshot showing the About sheet`

## History

- 2026-04-17 — 01 Scaffold ([PR #1](https://github.com/adnanreza/transit-v1/pull/1))
- 2026-04-17 — 02 Data Pipeline Foundation ([PR #2](https://github.com/adnanreza/transit-v1/pull/2))
- 2026-04-17 — 03 Frequency Computation ([PR #3](https://github.com/adnanreza/transit-v1/pull/3))
- 2026-04-17 — 04 Map Skeleton ([PR #4](https://github.com/adnanreza/transit-v1/pull/4))
- 2026-04-17 — 05 Frequency Coloring ([PR #5](https://github.com/adnanreza/transit-v1/pull/5))
- 2026-04-17 — 06 Controls ([PR #6](https://github.com/adnanreza/transit-v1/pull/6))
- 2026-04-17 — 07 URL State ([PR #7](https://github.com/adnanreza/transit-v1/pull/7))
- 2026-04-17 — 08 Route Detail Panel + Hover Tooltip ([PR #8](https://github.com/adnanreza/transit-v1/pull/8))
- 2026-04-17 — 09 Stops Layer ([PR #9](https://github.com/adnanreza/transit-v1/pull/9))
- 2026-04-18 — 10 Deploy to Netlify ([PR #11](https://github.com/adnanreza/transit-v1/pull/11))
- 2026-04-18 — 11 Weekly GTFS Data Refresh Cron ([PR #12](https://github.com/adnanreza/transit-v1/pull/12))
- 2026-04-18 — 12 Light Mode ([PR #14](https://github.com/adnanreza/transit-v1/pull/14))
