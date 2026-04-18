# 12 — Light Mode

SPEC calls for *"Dark base map by default — colored routes pop much more. Light mode toggle available."* We've been dark-only since 04. Ship the toggle so the light path exists, the map works in bright-daylight browsing, and the portfolio screenshots have an option.

Keep scope tight: one toggle that flips the whole UI + basemap + overlay layers between two coherent themes. No per-user server-side preference, no sunset-triggered auto-switching, no light-mode-specific palette variants beyond what's necessary for readability.

## Acceptance Criteria

### Theme state

- New `useTheme` hook in `src/lib/url-state.ts`: returns `['system' | 'dark' | 'light', setter]`, default `'system'`.
- URL param `?theme=light` / `?theme=dark`; omitted when `'system'` (use `clearOnDefault`).
- A companion `useResolvedTheme` (or a pure helper `resolveTheme(pref, systemIsDark)`) produces a concrete `'dark' | 'light'` for rendering, combining URL pref with the live `prefers-color-scheme` media query.
- `useUrlStateCleanup` sweeps unrecognized `?theme=` values (same path used for other params).

### Toggle UI

- New icon-only button in the top-right area of the overlay, to the right of the search button (or just above, next to the legend). shadcn `Button variant="ghost" size="icon"` with a muted background ring consistent with the other control tiles.
- Cycles three states: **system → light → dark → system**. Icon + tooltip reflect the *user's preference*, not the resolved theme: Monitor / Sun / Moon from lucide-react.
- Keyboard-reachable; `aria-label` names the current preference ("Theme: system / light / dark") and announces the next state on hover via `title`.

### App-level integration

- `App.tsx` resolves the theme on every render, then conditionally applies Tailwind's `dark` class to the root: `className={resolved === 'dark' ? 'dark ...' : '...'}`.
- shadcn components already drive off `.dark` via CSS variables — they come along for free.
- Audit hardcoded `bg-neutral-950`, `text-neutral-100`, `ring-white/10` etc. in overlay controls / tooltips / footer. Replace with either:
  - Tailwind semantic tokens (`bg-background`, `text-foreground`, `ring-border`) that flip via CSS variables, or
  - Explicit `dark:` variants when the semantic token isn't a clean fit.
  - Keep a consistent pattern so future components don't re-introduce dark-only styling.

### Basemap

- `buildMapStyle(url, theme: 'dark' | 'light')` — parameterize the Protomaps `namedTheme(...)` call.
- Map component watches resolved theme; when it changes, invoke `map.setStyle(nextStyle, { diff: true })`. Re-adds the route / stops / selected layers via the existing `addRouteLayers` path inside the `style.load` callback so the custom overlays don't get wiped by the style swap.
- Swap must not re-fetch `routes.geojson` / `stops.geojson` — the geojson sources should persist across the style change (`setStyle` with `diff: true` preserves sources when URLs match). Verify by watching devtools.

### Map overlay color inversions

- **Stops layer** — `#d4d4d4` (off-white on dark) ↔ `#404040` (dark slate on light). Keep the same stroke width; stroke color flips accordingly (`#0a0a0a` ↔ `#f5f5f5`).
- **Selected-route highlight** — `#ffffff` ↔ `#0a0a0a`.
- **Route color palette** — the viridis-ish ramp (yellow → green → teal → dark blue) reads well on dark and remains distinguishable on light, but the brightest band (`very_frequent` `#fde725`) will need a darker sibling for light backgrounds to keep contrast. Audit visually on both themes; introduce a per-theme palette constant only if the single palette fails a readability pass. Document the decision in a comment.
- **Peak-only / night-only dashed colors** (`#f97316`, `#8b5cf6`) — probably fine on both; re-verify.
- **No-service "dim" color + default opacity** — the NO_SERVICE gray was tuned for dark bg; pick a mirrored value for light.

### Performance

- No extra data fetches — theme swap is purely paint + style.
- MapLibre `setStyle({ diff: true })` should complete in <300 ms for this bundle; if worse, fall back to two pre-built style objects cached in memory.
- No change to initial JS budget (the toggle's icon components are a few hundred bytes gz).

### Accessibility

- Both themes pass **WCAG AA** on text-against-surface: controls, tooltip, legend, panel. Check with browser devtools' contrast checker on the deployed preview.
- Colorblind: the viridis-ish ramp must still survive grayscale + CB simulator in both themes. Re-verify after any palette tweak.
- Toggle button exposes `aria-pressed` semantics via its label; meaningful `aria-label` on every rotation.

## Out of Scope

- **Server-side / cross-device preference.** URL + system-preference only.
- **Sunrise/sunset auto-switch** (some sites do this; overkill here).
- **High-contrast / monochrome variants.** Separate accessibility feature.
- **Light-only print stylesheet.** Browsers do fine with system defaults.
- **Per-band palette per theme.** We'll introduce one only if the shared palette fails readability; prefer a single palette.
- **Animated transitions between themes.** CSS variable swap is instantaneous on flip; a slow transition on color would fight MapLibre's style swap and isn't worth the polish.

## Depends On

- `04`–`09` — the visual surface this toggles across.
- `10 Deploy` — live preview makes the light-mode audit trivial (just check `?theme=light` on yvrtransit.netlify.app).

## Notes

- **Why `system` as the default?** Respect OS preference; users who've picked dark or light already have an expectation. Explicit `?theme=...` overrides and round-trips through URL state like everything else.
- **Why `setStyle(..., { diff: true })` instead of a full re-init?** Preserves `geojson` sources by URL, avoids re-parsing routes.geojson (~540 KB gz) on every theme flip. Custom overlays still need re-adding via the `style.load` event because MapLibre clears user-added layers on a style swap.
- **Route palette decision logging** — the comment in `src/lib/band-palette.ts` should name whichever choice (shared palette vs. per-theme map) we ship, with a reason.
- **Commit plan (rough):**
  1. `feat: add useTheme URL hook with system-preference default + resolver`
  2. `feat: theme toggle button cycling system/light/dark with lucide icons`
  3. `feat: drive Tailwind dark class from resolved theme in App shell`
  4. `refactor: swap hardcoded dark colors for theme-aware Tailwind tokens`
  5. `feat: parameterize basemap style with theme variant and swap via setStyle`
  6. `feat: invert stops and selected-highlight colors for light mode`
  7. `test: resolveTheme combines URL pref with system preference correctly`
  8. (optional) `fix: bump very_frequent band color for light-bg contrast`
