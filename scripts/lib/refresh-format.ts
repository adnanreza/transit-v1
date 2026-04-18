// Pure formatters behind the weekly refresh-data workflow's PR body.
// Extracted from the CLI entrypoint so the behavior can be unit-tested without
// touching the filesystem or the GitHub Actions environment.

export interface RefreshSnapshot {
  feed_version: string
  generated_at: string | null
  route_count: number
  ftn_count: number
  frequencies_size: number
  routes_size: number
  stops_size: number
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}

export function fmtDelta(before: number, after: number): string {
  const diff = after - before
  if (diff === 0) return "no change"
  const sign = diff > 0 ? "+" : "−"
  return `${sign}${fmtBytes(Math.abs(diff))}`
}

export function fmtCountDelta(before: number, after: number): string {
  const diff = after - before
  if (diff === 0) return String(after)
  const sign = diff > 0 ? "+" : "−"
  return `${after} (${sign}${Math.abs(diff)})`
}

export interface RunLinkEnv {
  GITHUB_SERVER_URL?: string
  GITHUB_REPOSITORY?: string
  GITHUB_RUN_ID?: string
}

/**
 * Markdown run-link fragment for the PR body. Becomes a real link when the
 * workflow environment variables are present (Actions runner); falls back to
 * a literal placeholder otherwise so the summary script is still usable for
 * manual smoke-tests.
 */
export function runLink(env: RunLinkEnv): string {
  const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID } = env
  if (GITHUB_SERVER_URL && GITHUB_REPOSITORY && GITHUB_RUN_ID) {
    return `[Actions run](${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID})`
  }
  return "(run link unavailable outside Actions)"
}

/**
 * Decide which lead sentence the PR body should open with, given the before
 * and after snapshots. Three states:
 * - Feed version bumped — real content change, merge after sanity check.
 * - Feed unchanged but content differs — build-script change rather than a
 *   feed change. Worth a closer look.
 * - Feed unchanged and no content diff — only meta.json's timestamp moved,
 *   so the PR is effectively empty; the reviewer should close it.
 */
export function refreshHeadline(
  before: RefreshSnapshot,
  after: RefreshSnapshot,
): string {
  const feedChanged = before.feed_version !== after.feed_version
  const anyContentChanged =
    before.frequencies_size !== after.frequencies_size ||
    before.routes_size !== after.routes_size ||
    before.stops_size !== after.stops_size ||
    before.route_count !== after.route_count ||
    before.ftn_count !== after.ftn_count

  if (feedChanged) {
    return `Feed bumped from **${before.feed_version}** to **${after.feed_version}**.`
  }
  if (anyContentChanged) {
    return `Feed version unchanged (\`${after.feed_version}\`), but regeneration produced different data.`
  }
  return `Feed version unchanged (\`${after.feed_version}\`) — only \`meta.json\`'s timestamp moved. **Consider closing without merging.**`
}

export function summaryBody(
  before: RefreshSnapshot,
  after: RefreshSnapshot,
  env: RunLinkEnv = {},
): string {
  return [
    `## Weekly GTFS refresh`,
    ``,
    refreshHeadline(before, after),
    ``,
    `| Metric | Before | After |`,
    `| --- | --- | --- |`,
    `| Feed version | \`${before.feed_version}\` | \`${after.feed_version}\` |`,
    `| Route count | ${before.route_count} | ${fmtCountDelta(before.route_count, after.route_count)} |`,
    `| FTN-qualifying | ${before.ftn_count} | ${fmtCountDelta(before.ftn_count, after.ftn_count)} |`,
    `| frequencies.json (gz) | ${fmtBytes(before.frequencies_size)} | ${fmtBytes(after.frequencies_size)} (${fmtDelta(before.frequencies_size, after.frequencies_size)}) |`,
    `| routes.geojson (gz) | ${fmtBytes(before.routes_size)} | ${fmtBytes(after.routes_size)} (${fmtDelta(before.routes_size, after.routes_size)}) |`,
    `| stops.geojson (gz) | ${fmtBytes(before.stops_size)} | ${fmtBytes(after.stops_size)} (${fmtDelta(before.stops_size, after.stops_size)}) |`,
    ``,
    `Generated ${after.generated_at ?? "(unknown)"} · ${runLink(env)}`,
    ``,
  ].join("\n")
}
