# Current Feature: 16 Fix Theme Swap Drops Transit Layers

## Status

In Progress

## Goals

### Listener-ordering fix

- [ ] In `src/components/Map.tsx`, attach `map.once('style.load', …)` **before** calling `map.setStyle(...)`. MapLibre fires `style.load` synchronously during `setStyle` for this swap path, so a post-`setStyle` registration misses the dispatch and the reinstall callback never runs.
- [ ] Keep `setStyle(…, { diff: true })` — the bug is listener ordering, not the event.
- [ ] `addRouteLayers`'s `if (map.getLayer('routes-lines-solid')) return` guard stays; with the ordering fixed it correctly sees the emptied style and proceeds.
- [ ] Do not add an `isStyleLoaded()` guard inside the handler. The flag is transiently `false` when `style.load` fires for this swap — a naive guard would suppress the only emission we get.

### Effect cleanup

- [ ] Return a cleanup function that calls `map.off('style.load', handler)` so rapid theme toggles can't leak listeners (`off()` is a no-op when the listener has already fired or been removed).

### No regression to initial-mount behavior

- [ ] `prevThemeRef` early-return preserved. Initial layer install (the separate `frequencies`-seeded effect) is unchanged.

### Verification (browser)

- [ ] Dark → light: all 5 transit layers present; `map.getStyle().layers.length === 73`.
- [ ] Light → dark: same.
- [ ] Five rapid toggles: total layer count stays at 73 across iterations; no duplicates of any transit layer ID.
- [ ] Post-swap hover still drives `routes-lines-selected` correctly (paint applies cleanly at opacity 0.85 on the next hover).

## Notes

### Root cause

`map.setStyle(...)` dispatches `style.load` synchronously before control returns in the theme-swap code path. The existing code registered `map.once('style.load', …)` *after* the `setStyle` call, so the listener attached too late to catch the event. The reinstall callback never ran, the `setStyle` diff removed the imperatively-added transit layers (routes-lines-solid, routes-lines-dashed, routes-lines-rapid-casing, routes-lines-selected, stops-circles), and recovery required a full page refresh. Verified with live browser instrumentation: on a dark→light swap, `style.load` fires exactly once at the same tick as `setStyle`, and a `once` attached afterwards never hears it.

### Depends On

- `12 Light Mode` — introduced the theme-swap mechanism this fix amends; bug is latent from that feature.
- `15 Search & Map Detail Enhancements` — grew the layer count in the new style spec; may have made the symptom more visible, but didn't introduce the bug.

### Out of scope

- Refactoring theme-dependent paint expressions into a shared helper.
- Switching to `diff: false` — not needed once the ordering bug is fixed.
- Migrating off `setStyle` to swap paint expressions in place.
- Persistent selected-route highlight across swap — the pulse is transient by design (1.2s hold + 0.4s fade); the layer reinstalls in its default hidden state and hover re-drives it immediately.

### Key constraints

- Preserve Protomaps + user-layer z-order invariants (stops below routes below selected).
- No new dependencies; one-file change in `src/components/Map.tsx`.

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
- 2026-04-20 — 13 + 14 UX Overhaul (onboarding, copy, layout, rapid transit casing) ([PR #16](https://github.com/adnanreza/transit-v1/pull/16))
- 2026-04-21 — 15 Search & Map Detail Enhancements ([PR #17](https://github.com/adnanreza/transit-v1/pull/17))
