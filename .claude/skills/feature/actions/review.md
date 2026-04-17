# Review Action

1. Read `context/features/current-feature.md` to understand the goals
2. Read the corresponding feature spec in `context/features/` and `SPEC.md` for full context
3. Run `git diff main...HEAD --stat` and then review all code changes made for this feature
4. Check for:
   - ✅ Goals met (verify against Acceptance Criteria)
   - ❌ Goals missing or incomplete
   - ⚠️ Code quality issues or bugs
   - 🚫 Scope creep (code beyond goals — in a portfolio repo this is especially visible in the diff)
   - ♿ Accessibility: keyboard nav on controls, ARIA on the map overlay, color-contrast on text
5. Verify project-specific invariants:
   - **Performance budget** (from SPEC.md): initial JS < 300KB gzipped, total data payload < 5MB. Run `npm run build` and inspect `dist/` sizes if the feature touches bundle or data.
   - **Colorblind-safe palette** if this feature touched coloring — verify the ramp still passes a simulator (Sim Daltonism or equivalent) and survives grayscale.
   - **Attribution strings** ("Transit data © TransLink", "Map data © OpenStreetMap contributors") still render in the footer.
   - **URL state** round-trips cleanly — reload the page with the current URL and confirm the same map state is restored.
   - **FTN rule** (if this feature touches frequency logic) still matches the spec: median ≤15 min in every hour 06:00–21:00 on all three day types; per-trip-pattern; route shows its worst-qualifying pattern ≥20% of trips.
   - **No hardcoded secrets or API keys** committed (the project should have none, but double-check).
6. Check commit hygiene — commits should be atomic and use Conventional Commits. If a commit is too large or poorly-scoped, consider a rebase before opening the PR.
7. Final verdict: Ready to complete, or needs changes (list specific items to fix).
