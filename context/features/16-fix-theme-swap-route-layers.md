# 16 — Fix: Theme Swap Drops Transit Layers

Reported in-session after feature 15 shipped: switching the theme from dark to light wipes the colored route lines, stop dots, and selected-route highlight from the map. They don't come back on subsequent interactions — only a hard refresh restores them. The basemap itself repaints correctly; the missing pieces are the layers this app adds imperatively on top of the Protomaps style.

Root cause is a listener-attachment ordering bug in `src/components/Map.tsx`'s theme-swap effect:

```ts
map.setStyle(buildMapStyle(getPmtilesUrl(), theme), { diff: true })
map.once('style.load', () => { /* reinstall layers */ })
```

MapLibre dispatches `style.load` synchronously inside `setStyle` for our swap path — by the time the second line runs, the event has already fired and the one-time listener is attached too late to catch it. The reinstall callback never runs, `setStyle`'s diff removes the imperatively-added transit layers (routes-lines-solid, routes-lines-dashed, routes-lines-rapid-casing, routes-lines-selected, stops-circles) because they aren't in the new style spec, and the only recovery is a full page reload.

Verified with live instrumentation (playwright + a dev-only `__map` hook, removed before merge): on a dark→light swap, `style.load` fires exactly once at the same tick as `setStyle` is invoked, with `totalLayers` already dropping from 73 to 68 (the 5 transit layers removed). A `once(...)` attached afterwards never hears it.

This fix is a single local change: attach the `style.load` listener **before** calling `setStyle`, and return the effect cleanup that `off`s the handler so rapid theme toggles can't leak listeners.

## Acceptance Criteria

### Listener-ordering fix

- In `src/components/Map.tsx`, change the theme-swap effect so the `map.once('style.load', …)` registration happens *before* the `map.setStyle(...)` call, not after.
- Keep `setStyle(…, { diff: true })` — preserving the no-refetch benefit called out in the existing comment is still correct, and the bug is listener ordering, not the event itself.
- `addRouteLayers`'s `if (map.getLayer('routes-lines-solid')) return` guard stays in place. With the ordering fixed, the guard correctly sees the new (emptied) style and proceeds to reinstall.
- Do not add an `isStyleLoaded()` guard inside the handler. MapLibre fires `style.load` with `isStyleLoaded()` transiently `false` in this swap path; a guard that early-returns on false will block the reinstall entirely.

### Effect cleanup

- Return a cleanup function from the theme-swap effect that calls `map.off('style.load', handler)` so a rapid toggle (effect reruns before the previous `once` has fired) doesn't leak listeners. MapLibre's `off()` is a no-op when the listener isn't registered, so the cleanup is safe whether the handler already fired or not.

### No regression to initial-mount behavior

- Effect still early-returns on initial mount via `prevThemeRef`. Initial layer install (the separate `frequencies`-seeded effect) is unchanged.

### Verification (browser)

- Dark → light: all 5 transit layers present; `map.getStyle().layers.length === 73`.
- Light → dark: same.
- Five rapid toggles: total layer count stays at 73 across all iterations; each of the 5 transit layer IDs appears exactly once in the style (no duplicates from a leaked listener re-running `addRouteLayers`).
- No new console errors after the swap (one pre-existing "park" image warning is Protomaps-theme-related and unrelated).

## Out of Scope

- **Refactoring theme-dependent paint expressions** into a shared helper.
- **Switching to `diff: false`** to avoid the diff path entirely — would re-fetch pmtiles + geojson on every toggle and isn't needed once the listener-ordering bug is fixed.
- **Migrating off `setStyle` entirely** (swapping paint expressions in place on existing layers instead of rebuilding the style).
- **Persistent selected-route highlight across theme swap.** The `routes-lines-selected` pulse is transient by design (1.2s hold + 0.4s fade via `HIGHLIGHT_HOLD_MS`/`HIGHLIGHT_FADE_MS`); nothing visibly persistent is lost when the newly-reinstalled layer comes up in its default hidden state. The hover-highlight effect at `Map.tsx:728-742` re-drives the layer's filter/opacity on the next mousemove, so hover highlighting works immediately post-swap (verified in browser).

## Depends On

- `12 Light Mode` — introduced the theme-swap mechanism this fix amends.
- `15 Search & Map Detail Enhancements` — merged Protomaps label layers into the style and grew the layer count, which may have made the symptom more visible. Not a direct cause; the attachment-order bug was latent from feature 12.

## Notes

- **Why `setStyle` fires `style.load` synchronously for this swap.** MapLibre's `setStyle` short-circuits to the diff path when it can (same sources, same basic structure). The diff applies during the call, the internal `_loaded` flag flips, and the event emits before control returns to our useEffect body. So the order `setStyle(...)` → `once('style.load', …)` misses the dispatch every time for this swap shape.
- **Why not `styledata`?** It fires for the same swap, but also for tile-data ticks unrelated to the style swap we care about. Reliable, but noisier than `style.load`, which fires exactly once per style transition and carries the semantic we want (style is now the new one; reinstall layers). Also: using `styledata` and guarding on `isStyleLoaded()` is a trap — the flag is `false` when the event fires in this path, so a naive guard suppresses every single emission.
- **Commit plan:**
  1. `fix: attach style.load listener before setStyle so theme swap re-adds transit layers`
