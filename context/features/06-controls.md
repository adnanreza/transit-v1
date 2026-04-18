# 06 — Controls

Round out the map's interactivity with the three controls that were deferred from 05 so riders can actually interrogate the data: a **mode filter**, a **frequency threshold slider** (the interaction SPEC calls out as "the one that sells the concept"), and a **route search**. URL state for all of these lands in `07-url-state`; the side panel / hover tooltip stays punted to a later feature.

## Acceptance Criteria

### Mode filter

- Multi-select checkboxes for **Bus**, **SkyTrain**, **SeaBus**, **West Coast Express**. Default: all four enabled.
- Hiding a mode removes its routes from both the solid and dashed layers via a MapLibre filter update (no re-add). Opacity/color expressions stay untouched.
- Component: shadcn `ToggleGroup type="multiple"` or shadcn `Checkbox` group — whichever reads as "mode filter" more clearly. Lean `ToggleGroup` so it matches the day/window controls visually.
- Mode labels should be short enough to fit the controls card on typical viewports (bus-only users should not need to expand anything).

### Frequency threshold slider

- Lets the user redefine the three non-infrequent band boundaries: `very_frequent` cap, `frequent` cap, `standard` cap. `infrequent` is everything above the standard cap.
- **Thresholds must stay monotonic.** `very_frequent_max < frequent_max < standard_max`. Enforce via clamping when the user drags a handle past a neighbor.
- Range per handle: 1–60 min, 1-min steps. Defaults match SPEC.md (10 / 15 / 30).
- The map recolors live as the user drags (requestAnimationFrame-throttled if needed). Target: <100 ms repaint on toggle release on a mid-range laptop.
- **FTN qualification (the `ftn_qualifies` flag in `frequencies.json`) stays pinned at 15 min** — it's a canonical definition, not a visual preference. The legend should make this distinction clear: bands are user-configurable, the FTN label is the one fixed reference point.
- Peak-only and night-only bands are **not** affected by the slider. They're a different axis.
- Legend updates live as the slider moves so the ramp labels always match the current boundaries (e.g. `≤ 12 min`, `≤ 18 min`, etc).

### Route search

- Text input + shadcn `Command` palette. Focus state + keyboard navigation (arrow keys, enter to select) must work.
- **Route-number search is required.** Typing `99` or `b-line` surfaces matching routes; selecting one pans/zooms the map to the route's bounding box with a short animation (`easeTo`, ~600 ms) and applies a brief highlight (thicker or glowing stroke) that fades after 1.5–2 s.
- **Neighborhood search is a stretch** — nice to have for the portfolio narrative, skippable if the lift is too big. Two ways to implement:
  1. Hand-curated static list (`src/data/neighborhoods.json`) of ~30 Metro Vancouver neighborhoods with centroids — small, deterministic, no external dep.
  2. Nominatim geocoding bounded to Metro Vancouver — richer, but adds an external fetch + rate-limit handling.
  Pick (1) if shipping in-feature, (2) only if we want to demo an external API.
- Search box placement: top of the left sidebar or a dedicated top-left card. Do not put it in the top footer — it would fight the attribution card on narrow viewports.

### Other

- **Legend is dynamic** (was static in 05): the three band labels reflect the current slider values; the SkyTrain/SeaBus/WCE line-colors note stays, filtered by which modes are visible.
- **Smooth repaint** for all three controls. Mode changes swap `setFilter`; threshold changes swap `setPaintProperty`; search pan uses `easeTo`. None of them rebuild the style.
- **Accessibility**: all controls keyboard-reachable, ARIA labels match the visible labels, sliders announce their current value. The Command palette should work with a screen reader.
- **Unit tests** (Vitest) for the pure logic added in this feature:
  - `routeBandAt(route, day, window, thresholds)` with custom thresholds — routes reclassify as expected when the `frequent` cap is moved; peak/night still override.
  - `matchesModeFilter(route_type, enabledModes)` — simple predicate; one test per (bus/rapid/ferry) × (enabled/disabled) pairing.
  - Route-number query matching (prefix, exact, case-insensitive, handles `b-line` style aliases if we keep them simple).

## Performance / Data Budget

- Initial JS stays under SPEC's 300 KB gz. shadcn `Command` pulls in `cmdk`; it's small but audit the bundle impact and be ready to lazy-load the search palette if needed.
- Threshold slider should repaint at interactive rates. If the per-drag `setPaintProperty` chain becomes janky with ~240 routes × 6 bands of match labels, gate the expensive rebuild behind `requestAnimationFrame` or update only on release.
- No new data files.

## Out of Scope

- **URL state** (persist mode filter / thresholds / search term in the URL) → `07-url-state`.
- **Route hover tooltip / detail side panel** → its own feature later (likely `08-detail-panel`).
- **Zoom-level stop rendering** — stops are still punted until a feature that owns them shows up.
- **Light-mode toggle** — SPEC calls it out but it's not controls-primary; slot into a theming feature later if we bother.
- **Filter by FTN qualifying** — attractive but overlaps the threshold slider; skip unless it falls out naturally.

## Depends On

- `03 Frequency Computation` — needed for route band derivation (merged).
- `04 Map Skeleton` — map substrate (merged).
- `05 Frequency Coloring` — this feature extends the same Map component, control card, and legend (merged).

## Notes

- **`routeBandAt` refactor:** add an optional `thresholds?: { very_frequent: number; frequent: number; standard: number }` parameter, default to SPEC values (`10`, `15`, `30`). Existing callers keep working with no arg. This keeps the pure-function surface small while letting 06 feed user-supplied thresholds.
- **Band palette expressions:** `busColorExpression` and `busOpacityExpression` also need to take thresholds through. Keep the threshold param flowing from UI state to the expression builders — don't wire it through a global or context.
- **Mode filter and layer filter interplay:** the `routes-lines-solid` / `routes-lines-dashed` layers already have filters that partition by peak/night band. Compose the mode filter with an `all` combinator so the two conditions stack (`['all', existingPeakFilter, modeFilter]`).
- **Search affordances:** a `/` keyboard shortcut to focus search is table-stakes for anyone who lives in slack/linear/vscode. Free and worth doing.
- **Commit plan** (suggested):
  - `refactor: parameterize routeBandAt and palette expressions with user thresholds`
  - `test: add unit tests for thresholded band derivation`
  - `feat: mode filter (bus/skytrain/seabus/wce) with live layer filters`
  - `feat: frequency threshold slider with monotonic enforcement`
  - `feat: dynamic legend that reflects current threshold values`
  - `feat: route-number search via shadcn command palette with easeTo highlight`
  - `feat: add neighborhood search backed by a static list` *(stretch — skip if it grows past one commit)*
- **Colorblind / grayscale** re-verification isn't strictly required since the palette itself doesn't change. But if you adjust swatch styling for the dynamic legend, re-check the legend itself (not the map) against the simulator.
