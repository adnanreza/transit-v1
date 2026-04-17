# Test Action

1. Read `context/features/current-feature.md` to understand what was implemented
2. Read the corresponding feature spec in `context/features/` for the Acceptance Criteria
3. Identify pure functions and data-pipeline code added/modified for this feature. Prioritize testing:
   - GTFS parsing and normalization (calendar day-type resolution, holiday exceptions)
   - Headway / frequency band computation (median, per-pattern, FTN qualification rule)
   - URL state serialization/deserialization (filters round-trip losslessly)
   - Geometry simplification outputs stay within the data-size budget
4. Check if tests already exist for these functions
5. For functions without tests that have testable logic, write unit tests with **Vitest**:
   - Focus on pure functions, not React components
   - Test happy path + edge cases specific to this domain: midnight-spanning trips, service exceptions on holidays, routes with a single trip-pattern vs. many, windows with zero trips
   - Use small hand-rolled GTFS fixtures rather than the full feed
   - Don't write tests just to write them — use judgement
6. Run `npm test` to verify all tests pass
7. Verify each Acceptance Criteria item — note any that can't be covered by unit tests (e.g. "map renders correctly", "hover tooltip appears") as manual verification items for `review`
8. Report: tests written, tests passed, acceptance criteria covered, items needing manual check
