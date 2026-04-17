# Load Action

1. Check $ARGUMENTS (after "load"):
   - If it looks like a filename (single word, no spaces): Look for `context/features/{name}.md`
   - If it's multiple words: Use as inline feature description, generate goals
   - If empty: Error — "load" requires a spec filename or feature description

2. When loading a feature spec file:
   - Read the spec file fully — extract the Acceptance Criteria as goals
   - Read the Depends On section — warn if dependent features are not yet complete

3. Update `context/features/current-feature.md`:
   - Update H1 heading to include feature name (e.g., `# Current Feature: 01 Auth`)
   - Write goals as bullet points under ## Goals (derived from Acceptance Criteria)
   - Write any additional notes/context under ## Notes (dependencies, key constraints)
   - Set Status to "Not Started"

4. Confirm spec loaded and show the feature summary