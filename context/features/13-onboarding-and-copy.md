# 13 — Onboarding Sheet + Rider-Friendly Copy

Close the "what am I looking at?" gap. Right now a first-time visitor lands on a colored map with a panel labeled **THRESHOLDS** showing three numbered dots and has to reverse-engineer both the concept of the app and the meaning of every control. A casual bus rider new to Metro Vancouver and a hiring manager who doesn't take transit share the same problem: neither has the mental model the UI assumes.

Two orthogonal fixes, shipped together:

1. **A single place that explains the concept** (info button → side sheet with 30-second intro).
2. **Rewording the control labels** so "how often does the bus come?" reads the same as the domain-expert version.

Keep the surface area small. No onboarding tour, no auto-opening modal on first visit, no progressive disclosure of the existing controls — the goal is clarity, not a new UI.

## Acceptance Criteria

### Info button + About sheet

- **New `AboutSheet` component** (`src/components/AboutSheet.tsx`) built on the same shadcn `Sheet` primitive as the route detail panel (08). Opens from the right, `modal={false}` with a proper overlay dim so map clicks don't leak through while it's open. Esc and close-button dismiss.
- **New `Info` button** in the overlay, top-right, immediately left of the existing theme toggle. Same ghost-button styling as the theme toggle for visual consistency. Uses lucide `Info` icon; `aria-label="About this map"`.
- **Sheet content** — short, text-heavy, ~5 paragraphs:
  - *Headline:* "Metro Vancouver Frequent Transit Map"
  - *What it is:* one sentence on the concept ("This map colors TransLink routes by how often the bus actually comes at a given day and time.")
  - *The payoff:* one sentence grounded in user experience ("Yellow routes come every 10 minutes or better — show up without checking a schedule. Dark blue routes you'll want to time.")
  - *How to use it:* a ≤4-item list — click a route for details, toggle day / time, drag the sliders to ask "what counts as frequent?", search by route number
  - *FTN explainer:* spell out "Frequent Transit Network" and paraphrase TransLink's rule (≤15 min every hour 06:00–21:00, all three day types)
  - *Footer:* data source (TransLink GTFS, updated weekly), link to GitHub, link to SPEC.md
- **Not a first-run popup.** Don't auto-open; require the user to click the info button. First-run onboarding banners are noise; the button is always discoverable.

### Label rewrites

Replace terse / technical labels with rider-friendly phrasings. Labels live in:

- `ThresholdSlider`: `THRESHOLDS` → `HOW OFTEN IS "FREQUENT"?` with a muted subtitle `Drag to customize.`
- `ModeFilter`: `MODE` → `SHOW`
- `FrequencyControls`: `DAY TYPE` → `WHICH DAY`; `TIME WINDOW` → `TIME OF DAY`

Keep the existing semantic heading tags (`<h2>`) and uppercase-tracking style — we're swapping the *words*, not redesigning the panels.

### Legend band phrasing

The current legend shows bare mathematical cutoffs (`≤ 10 min`, `> 30 min`). Rephrase to describe the *rider experience* while keeping the same compact row:

| Current | After |
|---|---|
| `≤ 10 min` | `Very frequent — every 10 min or better` |
| `≤ 15 min (FTN)` | `Frequent — every 15 min (FTN)` |
| `≤ 30 min` | `Standard — every 30 min or better` |
| `> 30 min` | `Infrequent — every 30+ min` |
| `Peak only` | `Peak only (rush hour)` |
| `Night only` | `Night only (overnight)` |
| `No service` | `No service at this time` |

Constraint: the longest row must still fit the 14rem legend width; truncate only if absolutely necessary (verify in both themes).

The slider-tick labels below the thresholds stay terse (`Very freq / Frequent / Standard`) — they live beside actual number values, so context is implicit.

### FTN acronym

Currently the string "FTN" appears in the legend without expansion. Keep it in the legend row (compact) but ensure the acronym is spelled out at least once on the first surface a new visitor sees — which, with the info sheet, is the About sheet's FTN explainer paragraph. Route detail panel's FTN status section already says "Frequent Transit Network" in its section header; no change needed there.

### Hover tooltip + route detail panel

No copy changes. The tooltip and panel already read naturally; the FTN failure explanation from 08 ("Weekday 6 AM headway is 25 min; …") already speaks in rider terms.

### Accessibility

- Info button: `aria-label="About this map"`; sheet: `aria-labelledby` points at the sheet title.
- Label changes preserve the existing heading semantics.
- No loss of shadcn focus trap — the About sheet uses the same `modal={false}` + explicit autofocus pattern as 08's route detail panel.

## Out of Scope

- **Auto-opening on first visit.** Too intrusive, easy to regret; the button is always there.
- **Full onboarding tour** (Shepherd / Driver-style step-through). Heavier than needed for a map with four controls.
- **Contextual tooltips on every panel**. The About sheet covers the concept; individual tooltips would duplicate and clutter.
- **Curated example routes** ("try the 99 B-Line!"). Tempting but goes stale as GTFS shifts and needs ongoing curation. Revisit if user testing confirms people don't know where to start.
- **Progressive disclosure of power controls.** The threshold slider is specifically called out in SPEC as "the interaction that sells the concept"; hiding it behind a "Customize" button defeats the point.
- **Rewriting the band *names* themselves** (Very frequent / Frequent / Standard / Infrequent). They're already reasonably plain; a full re-taxonomy ("show up and go" / "worth checking" / "plan ahead") risks reading as cutesy.

## Depends On

- `04–09` — everything the info sheet describes.
- `08 Route Detail Panel` — reuses the shadcn Sheet primitive + the `modal={false}` pattern.
- `12 Light Mode` — any new text surface needs to be theme-aware from the start (palette-correct overlay tile, `dark:` variants).

## Notes

- **Why a side sheet and not a dialog?** The route detail panel already trained the user to expect side-sheet content on the right. Same affordance for "more information" keeps the mental model consistent.
- **Why not auto-open on first visit?** localStorage-based first-run banners are routinely dismissed without being read, and they nag returning users whose browser cleared the key. A visible button with a clear icon is the cleanest equivalent.
- **Why not replace "Very frequent" with "Show up and go"?** Considered. The phrase is evocative but mixes registers with "Peak only" / "Night only" which stay descriptive. Keep the vocabulary consistent.
- **The label rewrites are stylistic, not structural.** No new hooks, no prop surgery. The risk is low enough that I'd even consider bundling (1) + (2) into a single commit, but the two changes have different review concerns (copy vs. new component) so keep them split.
- **Commit plan:**
  1. `feat: add About info button and onboarding side sheet`
  2. `feat: rider-friendly labels on controls and legend`
  3. (optional) `docs: README screenshot showing the About sheet`
