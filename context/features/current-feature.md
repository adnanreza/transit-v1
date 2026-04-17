# Current Feature: 01 Scaffold

## Status

Not Started

## Goals

- `npm run dev` launches Vite on port 5173
- `npm run build` produces `dist/` with initial JS < 100 KB gzipped
- `npm run typecheck` passes (`tsc --noEmit`)
- `npm run lint` passes (ESLint on `src/`)
- `npm test` passes (Vitest + one placeholder test)
- Tailwind configured, utility class visible on the placeholder page
- shadcn/ui initialized (`components.json`, path alias `@/*`, `src/lib/utils.ts`) — no components installed yet
- Placeholder page renders: project title, one-line description, attribution footer
- `README.md` at repo root: purpose, pointer to `SPEC.md`, run/build/test commands, Claude Code note
- `.nvmrc` pins Node 20

## Notes

- Depends on: nothing (root of feature graph)
- Performance budget: initial JS < 100 KB gzipped (SPEC.md sets 300 KB for the full app)
- Commit plan: `chore: scaffold vite + react + ts` → `chore: add tailwind` → `chore: initialize shadcn/ui` → `chore: add vitest + placeholder test` → `docs: add README`
- Use Vite's official `react-ts` template; don't hand-roll
- Path alias `@/*` → `./src/*` is required by shadcn

## History

<!-- Completed features will be appended here as `- YYYY-MM-DD — <feature name> ([PR #N](<url>))` -->
