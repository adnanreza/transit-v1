# Current Feature: 12 Light Mode

## Status

In Progress

## Goals

### Theme state
- `useTheme` hook in `src/lib/url-state.ts`: `['system' | 'dark' | 'light', setter]`, default `'system'`
- URL param `?theme=light` / `?theme=dark`; omitted when `system` (via `clearOnDefault`)
- Pure `resolveTheme(pref, systemIsDark)` helper + optional `useResolvedTheme` that combines pref with `prefers-color-scheme` media query
- `useUrlStateCleanup` sweeps invalid `?theme=` values

### Toggle UI
- New icon button top-right overlay (right of search or near legend), shadcn `Button variant="ghost" size="icon"` styled like other control tiles
- Cycles **system → light → dark → system**
- Icon reflects user *preference*, not resolved theme: Monitor / Sun / Moon (lucide-react)
- Keyboard-reachable; `aria-label` names current preference; `title` announces next state

### App-level integration
- `App.tsx` resolves theme per render → conditionally applies `dark` class to root
- shadcn components come along for free via CSS variables
- Audit hardcoded `bg-neutral-950`, `text-neutral-100`, `ring-white/10` etc. — replace with semantic tokens (`bg-background`, `text-foreground`, `ring-border`) or explicit `dark:` variants
- Establish a consistent pattern so future components don't re-introduce dark-only styling

### Basemap
- `buildMapStyle(url, theme: 'dark' | 'light')` parameterized
- Map watches theme; on change, `map.setStyle(nextStyle, { diff: true })` and re-adds route/stops/selected layers via existing `addRouteLayers` path in the `style.load` callback
- No re-fetch of `routes.geojson` / `stops.geojson` — verify sources persist across style swap

### Map overlay color inversions
- Stops: `#d4d4d4` ↔ `#404040`; stroke `#0a0a0a` ↔ `#f5f5f5`
- Selected-route highlight: `#ffffff` ↔ `#0a0a0a`
- Route palette: viridis-ish ramp audited on both themes; introduce per-theme palette only if readability fails. Document decision in `band-palette.ts` comment
- Peak-only / night-only dashed colors re-verified on light bg
- NO_SERVICE dim color mirrored for light bg

### Performance
- No extra data fetches
- Style swap target <300 ms; fallback to pre-built style objects if slow
- No change to initial JS budget

### Accessibility
- WCAG AA text-on-surface contrast in both themes — verified with devtools contrast checker
- Colorblind-safe ramp survives grayscale + CB simulator in both themes
- Toggle button has meaningful `aria-label` + `aria-pressed`-style state

## Notes

- Depends on: **04–09** (visual surface), **10** (deploy — live preview makes audit trivial via `?theme=light` on yvrtransit.netlify.app)
- **Why `system` default?** Respect OS preference; explicit URL param overrides and round-trips like other state
- **Why `setStyle({ diff: true })`?** Preserves geojson sources (avoids re-parsing ~540 KB gz routes.geojson); custom overlays still need re-add via `style.load` event
- Out of scope: server-side preference, sunrise/sunset auto-switch, high-contrast variants, print stylesheet, per-band palette per theme (prefer single palette), animated transitions
- **Commit plan**:
  1. `feat: add useTheme URL hook with system-preference default + resolver`
  2. `feat: theme toggle button cycling system/light/dark with lucide icons`
  3. `feat: drive Tailwind dark class from resolved theme in App shell`
  4. `refactor: swap hardcoded dark colors for theme-aware Tailwind tokens`
  5. `feat: parameterize basemap style with theme variant and swap via setStyle`
  6. `feat: invert stops and selected-highlight colors for light mode`
  7. `test: resolveTheme combines URL pref with system preference correctly`
  8. (optional) `fix: bump very_frequent band color for light-bg contrast`

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
