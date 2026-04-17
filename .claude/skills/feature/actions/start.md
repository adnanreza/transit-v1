# Start Action

1. Read `context/features/current-feature.md` — verify Goals section is populated
2. If empty, error: "Run /feature load first"
3. Read `SPEC.md` for the conventions and constraints this feature must respect (FTN rule, perf budget, data pipeline shape, attribution rules)
4. Set Status to "In Progress"
5. Ensure working tree is clean. Create and checkout a feature branch from `main` (derive name from H1 heading, e.g. `feature/03-frequency-coloring`)
6. List the goals, then implement them one by one
7. After each goal:
   - Run `npm run typecheck` and `npm run lint` (skip if scripts aren't defined yet)
   - Commit the goal as its own focused commit with a Conventional Commits message (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`). The commit message should describe the *what and why* in the subject, not the implementation detail.

   Good: `feat: compute median headway per trip pattern`
   Bad: `add loop over stop_times and call median()`

8. Keep commits atomic — one logical change each. If a goal naturally splits (e.g. "add util" + "wire util into builder"), commit them separately.
9. Don't push during `start` — pushing happens in `complete` after the full review.
