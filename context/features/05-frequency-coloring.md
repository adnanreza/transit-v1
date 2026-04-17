# 05 — Frequency Coloring

Color bus routes by frequency band using the data computed in 03, and ship the two controls the coloring can't be demoed without: **day-type toggle** and **time-window toggle**. This is the feature that turns the project from "a map of TransLink" into "the frequency map." Mode filter, threshold slider, search, and URL state come later in `06-controls` / `07-url-state` — including them here would bloat the PR past what one review comfortably holds.

## Acceptance Criteria

- **Load `public/data/frequencies.json`** on map mount (small, pre-loaded, no spinner).
- **Bus routes** (`route_type = '3'`) are colored by their frequency band **at the currently selected (day_type, time_window)**. Rapid transit (`route_type` in `1, 2, 4`) keeps its GTFS `route_color` from 04 — SkyTrain's Expo blue, Millennium yellow, Canada Line teal, SeaBus, WCE — because those are more instantly recognizable than "yes, it's frequent" (they all are).
- **Frequency ramp** matches SPEC.md: `very_frequent` ≤10 min, `frequent` ≤15 min (the FTN threshold), `standard` ≤30 min, `infrequent` >30 min. Four colors on a perceptually-uniform, colorblind-safe ramp (viridis-ish).
  - Must survive a colorblind simulator (deuteranopia, protanopia, tritanopia).
  - Must survive desaturation to grayscale (portfolio screenshots land there).
  - Pick specific hex values in the implementation; don't ship placeholder colors.
- **Peak-only and night-only** routes use a **dashed `line-dasharray`** in their band color, *not* a 5th/6th ramp slot. Those are a "when" axis, not a "how often" axis (SPEC decision). Their dash pattern should still be visibly dashed at z10 without looking noisy.
- **No-service** handling: if a route has no trips in the selected window (e.g. a peak-only route on "evening"), render it greyed out and semi-transparent — still visible as "this route exists," but clearly off-duty.
- **Day-type toggle** (Weekday / Saturday / Sunday) — single-select, shadcn `ToggleGroup` or `Tabs`.
- **Time-window toggle** (All day / AM peak / Midday / PM peak / Evening / Late night) — single-select, same component family.
- Controls sit in a floating card distinct from the attribution footer; positioning should not fight the map (try bottom-left; avoid covering downtown on typical viewport sizes).
- **Legend** is always visible. Static for this feature (threshold slider that makes it dynamic is 06). Matches the band colors + dashed treatment exactly.
- **Smooth repaint** when controls change — the map recolors via a MapLibre data-driven expression update, not a full style rebuild. No flicker, no reload.
- **Unit tests** (Vitest) for the pure derivation:
  - `routeBandAt(route, day_type, time_window)` — returns `peak_only` / `night_only` regardless of window; otherwise worst major pattern's band at that window; `null` when the route has no service in the window.
  - Handles missing headway entries (`null` in the schema) without crashing.

## Rendering Split

04 already has a single `routes-lines` layer with a `['case', isBus, …]` width expression. For 05, split by dash treatment so dashed rendering is clean:

- `routes-lines-solid` — buses with a frequency band + rapid transit; driven by a color expression keyed on `route_type` (rapid transit → `route_color`, bus → band color from the joined frequency data).
- `routes-lines-dashed` — peak-only and night-only routes only; same color logic but with `line-dasharray` set.
- Filter expressions partition features between the two layers so no route appears twice.
- `line-sort-key` still puts rapid transit on top.

## Data Join

Two options; pick whichever is simpler in the implementation:

1. **Runtime join:** fetch `frequencies.json`, build a `{ route_id → band-per-window }` map, set a `['match', ['get', 'route_id'], …]` expression. Simple for a few hundred routes.
2. **Precompute into features:** a small script adds a `band` property per `(day_type, window)` directly onto `routes.geojson` features, and the expression reads `route_band_weekday_am_peak` etc. Trades file size for expression simplicity.

Start with option 1. Only switch to option 2 if expression performance is visibly bad.

## Performance / Data Budget

- `frequencies.json` is ~a few hundred KB; already in SPEC's 5 MB data budget (shipped by 03).
- Initial JS stays under 300 KB gz — still met after 04's lazy-load. Control components are shadcn, which bundles into the Map chunk or a new lazy chunk.
- Repaint on toggle change: under 100 ms on a mid-range laptop. Single `setPaintProperty` call, not a restyle.

## Out of Scope

- **Threshold slider** (let users redefine the bands live) → `06-controls`.
- **Mode filter** (checkboxes for Bus / SkyTrain / SeaBus / WCE) → `06-controls`.
- **Search** (jump-to by route or neighborhood) → `06-controls`.
- **URL state** for the selected day_type / time_window → `07-url-state`.
- **Route detail panel** on click → its own feature later.
- **Hover tooltip** showing route number + current band → bundled with detail panel.

## Depends On

- `03 Frequency Computation` — needs `public/data/frequencies.json` (merged).
- `04 Map Skeleton` — needs the map substrate (merged).

## Notes

- **Legend placement:** a compact vertical stack in the bottom-right, away from MapLibre's attribution control (which sits bottom-right too — nudge one or the other, don't overlap).
- **Rapid transit and the ramp:** rapid transit always uses `route_color`, but the legend should still mention this (a small "SkyTrain / SeaBus / WCE shown in their line colors" line). Hiding the rule in code would confuse a first-time viewer.
- **Default state:** Weekday + All day. Most representative, matches what most users want to see first.
- **Commit plan** (suggested):
  - `feat: load frequencies.json and expose via a useFrequencies hook`
  - `feat: add routeBandAt helper and unit tests`
  - `feat: split route rendering into solid + dashed layers`
  - `feat: apply band-driven line-color to bus routes`
  - `feat: day-type and time-window toggle controls`
  - `feat: static legend`
  - `refactor: move control + legend positioning to not fight map attribution`
- **Colorblind verification:** Sim Daltonism on macOS is the quickest check. Desaturation check: screenshot → Preview → Tools → Adjust Color → saturation 0. Both should be part of the PR's manual verification checklist, not just promises.
