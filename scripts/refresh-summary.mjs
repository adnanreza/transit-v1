#!/usr/bin/env node
// Summary helper for the refresh-data.yml GitHub Action. Two modes:
//
//   node refresh-summary.mjs --capture <outPath>
//     Writes a JSON snapshot of the currently-committed data/ state to
//     <outPath> — feed version, route counts, FTN count, gz'd file sizes.
//
//   node refresh-summary.mjs --summary <beforePath> <bodyOutPath>
//     Reads the before-snapshot, computes deltas against the now-current
//     state, writes a markdown PR body to <bodyOutPath>, and emits
//     key=value pairs for $GITHUB_OUTPUT to stdout (feed_after, today,
//     generated_at) so the workflow can reference them.

import fs from "node:fs"
import path from "node:path"
import zlib from "node:zlib"

const DATA_DIR = "public/data"

function gzSize(file) {
  if (!fs.existsSync(file)) return 0
  return zlib.gzipSync(fs.readFileSync(file)).length
}

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback
  return JSON.parse(fs.readFileSync(file, "utf8"))
}

function snapshot() {
  const meta = readJson(path.join(DATA_DIR, "meta.json"), {
    feed_version: "(none)",
    generated_at: null,
  })
  const freq = readJson(path.join(DATA_DIR, "frequencies.json"), {})
  const routeCount = Object.keys(freq).length
  const ftnCount = Object.values(freq).filter((r) => r.ftn_qualifies).length
  return {
    feed_version: meta.feed_version,
    generated_at: meta.generated_at,
    route_count: routeCount,
    ftn_count: ftnCount,
    frequencies_size: gzSize(path.join(DATA_DIR, "frequencies.json")),
    routes_size: gzSize(path.join(DATA_DIR, "routes.geojson")),
    stops_size: gzSize(path.join(DATA_DIR, "stops.geojson")),
  }
}

function fmtBytes(n) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}

function fmtDelta(before, after) {
  const diff = after - before
  if (diff === 0) return "no change"
  const sign = diff > 0 ? "+" : "−"
  return `${sign}${fmtBytes(Math.abs(diff))}`
}

function fmtCountDelta(before, after) {
  const diff = after - before
  if (diff === 0) return String(after)
  const sign = diff > 0 ? "+" : "−"
  return `${after} (${sign}${Math.abs(diff)})`
}

function summaryBody(before, after) {
  const feedChanged = before.feed_version !== after.feed_version
  const anyContentChanged =
    before.frequencies_size !== after.frequencies_size ||
    before.routes_size !== after.routes_size ||
    before.stops_size !== after.stops_size ||
    before.route_count !== after.route_count ||
    before.ftn_count !== after.ftn_count

  const headline = feedChanged
    ? `Feed bumped from **${before.feed_version}** to **${after.feed_version}**.`
    : anyContentChanged
      ? `Feed version unchanged (\`${after.feed_version}\`), but regeneration produced different data.`
      : `Feed version unchanged (\`${after.feed_version}\`) — only \`meta.json\`'s timestamp moved. **Consider closing without merging.**`

  const runLink = process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
    ? `[Actions run](${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID})`
    : "(run link unavailable outside Actions)"

  return [
    `## Weekly GTFS refresh`,
    ``,
    headline,
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
    `Generated ${after.generated_at ?? "(unknown)"} · ${runLink}`,
    ``,
  ].join("\n")
}

function main() {
  const [flag, ...rest] = process.argv.slice(2)

  if (flag === "--capture") {
    const [outPath] = rest
    if (!outPath) {
      console.error("usage: refresh-summary.mjs --capture <outPath>")
      process.exit(1)
    }
    fs.writeFileSync(outPath, JSON.stringify(snapshot(), null, 2))
    return
  }

  if (flag === "--summary") {
    const [beforePath, bodyOutPath] = rest
    if (!beforePath || !bodyOutPath) {
      console.error(
        "usage: refresh-summary.mjs --summary <beforePath> <bodyOutPath>",
      )
      process.exit(1)
    }
    const before = readJson(beforePath, null)
    if (!before) {
      console.error(`refresh-summary: before snapshot not found at ${beforePath}`)
      process.exit(1)
    }
    const after = snapshot()
    fs.writeFileSync(bodyOutPath, summaryBody(before, after))

    const today = new Date().toISOString().slice(0, 10)
    const outputs = [
      `feed_after=${after.feed_version}`,
      `today=${today}`,
      `generated_at=${after.generated_at ?? ""}`,
    ]
    process.stdout.write(outputs.join("\n") + "\n")
    return
  }

  console.error("usage: refresh-summary.mjs --capture <outPath>")
  console.error("       refresh-summary.mjs --summary <beforePath> <bodyOutPath>")
  process.exit(1)
}

main()
