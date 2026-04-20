# Current Feature: 14 Layout + Information Architecture Overhaul (extends 13)

## Status

In Progress

## Goals

Per [context/features/14-layout-overhaul.md](14-layout-overhaul.md):

1. **Typography consistency** — finish sentence-case pass in panel + About sheet
2. **Chart y-axis** — fixed domain + inline FTN reference label
3. **Termini dedupe** — reverse-direction pattern pairs collapse to one ⇄ line
4. **FTN ✗ amber color** — visual warning encoding
5. **Attribution dedupe** — hide MapLibre's auto-OSM credit
6. **Route badge** — bigger, better hierarchy in panel header
7. **Toggle contrast** — stronger ToggleGroupItem pressed/unpressed
8. **Compact horizontal legend** — colorbar instead of 7-row card
9. **Bottom control strip** — horizontal strip replaces corner card
10. **Mobile layout** — stacks vertically at <640px, no overlap
11. **Sheet coordination** — About closes route panel and vice versa

## Notes

- Continues on feature/13 branch (no new branch cut — scope growth, same files)
- PR at `/feature complete` time will be titled "13 + 14 UX Overhaul"
- All the 13 commits (7 of them) stay — new commits stack on top
- Depends on 08/09/10/12 being merged (all are)

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
