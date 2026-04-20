# 14 — Layout & Information Architecture Overhaul

Ship everything surfaced by the full design audit. Folds into the existing
feature/13 branch since many items touch files 13 already edited (conflict
avoidance > ceremonial branch split). PR scope will be re-titled at
`/feature complete` to reflect the combined work.

The audit named 15 issues. This spec locks in the ones that genuinely move
the needle — roughly: the app's layout breaks on mobile, uses corner cards
when it should use a strip, and hides a great frequency chart inside an
auto-scaled Y-axis that reads as empty.

## Acceptance Criteria

### Typography consistency (finish the pass)
- `text-[11px] font-medium uppercase tracking-wider text-neutral-500` is banned from new code and removed from every existing section heading.
- Replace with `text-xs font-medium text-neutral-900 dark:text-neutral-100` (already used for the bottom-left controls).
- Apply to: RouteDetailPanel sections (`FREQUENT TRANSIT NETWORK`, `24-HOUR HEADWAY`, `TERMINI`), AboutSheet sections (`WHAT YOU'RE LOOKING AT`, `HOW TO USE IT`, `WHAT "FTN" MEANS`, `ABOUT THE DATA`), and any strays.

### Chart y-axis — fixed domain, anchored reference line
- `RouteFrequencyChart`: set Y domain to `[0, max(maxSeriesHeadway, 45)]` or similar fixed floor so the 15-min reference line is always near the middle.
- Inline reference-line label: `"15 min (FTN)"` on the line itself, not only in the caption below.
- Remove the separate caption ("Headway in minutes. Lower bars = more frequent.") — the inline label + axis naming carries the meaning.

### Termini — dedupe reverse-direction pairs
- New pure helper `normalizePatternTermini(patterns)` in `src/lib/route-patterns.ts`: collapses pattern pairs whose (first_stop_name, last_stop_name) are swapped reverses into a single "A ⇄ B" entry.
- When a route has exactly two major patterns that are directional reverses, show one line. Preserve the non-swapped case (an actual branch).
- Tests cover: two-way same pair, branch with different endpoints, single direction, three patterns.

### FTN status — amber for ✗, not neutral
- Panel's "Not FTN-qualifying" line gets `text-amber-500` (or similar in the warning family) so it visually encodes "this didn't pass" without shouting red.

### Attribution dedupe
- Hide MapLibre's auto-attribution since our footer carries both OSM + TransLink credits.
- Pass `attributionControl: false` to the MapLibre `Map` constructor; keep OSM credit in our footer.

### Route badge redesign
- Bigger, more legible. `h-11 min-w-11` → `h-12 min-w-14`, larger text, reduce the white-on-color contrast failure potential by ensuring text color contrasts with the badge bg (use a `darkenOrLighten(bg)` helper or force a specific text color per band).

### Toggle pressed/unpressed contrast
- ToggleGroupItem styling override (local CSS-in-className or a custom variant):
  - Unpressed: visible border + subtle bg tint (`bg-neutral-100 dark:bg-neutral-800`) — currently pure outline, reads as text
  - Pressed: strong fill (`bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900`) for clear differentiation
- Applied to: FrequencyControls (day + time), ModeFilter.

### Compact horizontal legend
- `Legend` becomes a slim horizontal colorbar:
  - A single row with colored segments labeled by the threshold values: `≤10 — 15 — 30 — ∞ min`
  - A second compact line with dashed swatches for peak/night + no-service
  - The "SkyTrain uses line colors" note becomes a tooltip on a small ⓘ next to the legend (or lives in the AboutSheet and disappears from the legend).
- Target height: ≤64px when expanded; collapsible further behind a chevron at narrow widths.

### Bottom control strip
- Replace the corner card with a single horizontal strip across the bottom of the viewport.
- Left: [Day] [Time] as two tight ToggleGroups, separated by a vertical divider.
- Right-of-center: [Show] chips.
- Right: [Thresholds] slider (smaller, compact mode — value chips only, no labels below).
- Legend tucked into the right edge of the strip OR immediately above the footer on the right.
- Target height: ~72–96px including padding. Everything visible at a glance, no card-within-card.
- If there's no room for all controls horizontally, hide Mode + Thresholds behind a "Customize ▾" popover; keep Day + Time always visible.

### Mobile layout
- At `<640px` (sm breakpoint):
  - The bottom strip stacks vertically: Day row, Time row, (Show + Thresholds) row.
  - Legend collapses to a single-line tappable accordion at the bottom.
  - Top-right icon cluster stays, Search stays.
- Legend + controls must not overlap at any viewport width.

### Sheet coordination
- Opening the About sheet closes the route detail panel (and vice versa) so they can't stack.
- Clicking the About button while About is open toggles it closed.

### Chart tooltip — style match
- Recharts' default tooltip styling already matches dark mode; verify it still reads in light mode. Update if the bg becomes unreadable.

## Performance

- No new data fetches.
- Bundle budget untouched (target no increase beyond +3 KB gz on initial JS).

## Out of Scope

- **Network-level "X FTN-qualifying routes today" stat panel.** Tempting but adds a new concept; defer to its own feature.
- **Filter "show only FTN-qualifying routes" as a map-level toggle.** Power-user feature; future.
- **Compare weekday vs Sunday split view.** v2 per SPEC.
- **Unified top-bar with search + icons as one pill.** Nice-to-have but the current separation works; defer unless audit re-flags.
- **First-visit ambient hint** ("click any route"). Covered by the About sheet's explicit "How to use it" list.
- **Empty-state messaging** when all modes filtered off. Acceptable v1 gap.
- **Refactor RouteTooltip position to follow cursor with connection line.** Current placement works.

## Depends On

- Builds on the feature/13 branch directly — all its commits are prerequisite.
- `08` (panel), `09` (stops), `10` (deploy), `12` (light mode) — all feeding into the surfaces being redesigned.

## Notes

- **Branching strategy:** continue on `feature/13-onboarding-and-copy` rather than cutting a new branch. Many files already edited by 13 will be re-edited here; separating branches would create merge friction for no benefit. At `/feature complete` time, the PR title/body will reflect the combined "13 + 14 — UX Overhaul" scope.
- **Why fix the chart y-axis now?** It's the biggest "but does the data even look right?" failure for someone actually checking how frequent a route is. A hiring manager opening route 99 expects to see a chart that says something.
- **Why dedupe termini?** Riders think in A ⇄ B, not in "pattern_id directional hash." Showing reverse twice communicates "this route goes to 4 places" when it goes to 2.
- **Commit plan (rough)** — in order of increasing risk:
  1. `feat: dedupe reverse-direction patterns in the termini list`
  2. `test: normalizePatternTermini collapses reverse pairs`
  3. `feat: amber warning color for the Not FTN-qualifying state`
  4. `feat: hide MapLibre's default OSM attribution (we carry it in the footer)`
  5. `feat: fixed chart y-axis + inline 15-min reference label`
  6. `refactor: sentence-case section headings in panel and about sheet`
  7. `feat: stronger ToggleGroup pressed/unpressed contrast`
  8. `feat: coordinate About and Route sheets — opening one closes the other`
  9. `feat: enlarge route badge for stronger panel header hierarchy`
  10. `feat: compact horizontal legend`
  11. `feat: bottom control strip replaces corner card; responsive stack on mobile`
