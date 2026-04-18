#!/usr/bin/env tsx
// Summary helper for .github/workflows/refresh-data.yml. Two modes:
//
//   tsx refresh-summary.ts --capture <outPath>
//     Writes a JSON snapshot of the currently-committed data/ state to
//     <outPath> — feed version, route counts, FTN count, gz'd file sizes.
//
//   tsx refresh-summary.ts --summary <beforePath> <bodyOutPath>
//     Reads the before-snapshot, computes deltas against the now-current
//     state, writes a markdown PR body to <bodyOutPath>, and emits
//     key=value pairs for $GITHUB_OUTPUT to stdout (feed_after, today,
//     generated_at) so the workflow can reference them.

import fs from "node:fs"
import path from "node:path"
import zlib from "node:zlib"
import { summaryBody, type RefreshSnapshot } from "./lib/refresh-format.ts"

const DATA_DIR = "public/data"

function gzSize(file: string): number {
  if (!fs.existsSync(file)) return 0
  return zlib.gzipSync(fs.readFileSync(file)).length
}

function readJson<T>(file: string, fallback: T): T {
  if (!fs.existsSync(file)) return fallback
  return JSON.parse(fs.readFileSync(file, "utf8")) as T
}

function snapshot(): RefreshSnapshot {
  const meta = readJson<{ feed_version: string; generated_at: string | null }>(
    path.join(DATA_DIR, "meta.json"),
    { feed_version: "(none)", generated_at: null },
  )
  const freq = readJson<Record<string, { ftn_qualifies: boolean }>>(
    path.join(DATA_DIR, "frequencies.json"),
    {},
  )
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

function main(): void {
  const [flag, ...rest] = process.argv.slice(2)

  if (flag === "--capture") {
    const [outPath] = rest
    if (!outPath) {
      console.error("usage: refresh-summary.ts --capture <outPath>")
      process.exit(1)
    }
    fs.writeFileSync(outPath, JSON.stringify(snapshot(), null, 2))
    return
  }

  if (flag === "--summary") {
    const [beforePath, bodyOutPath] = rest
    if (!beforePath || !bodyOutPath) {
      console.error(
        "usage: refresh-summary.ts --summary <beforePath> <bodyOutPath>",
      )
      process.exit(1)
    }
    const before = readJson<RefreshSnapshot | null>(beforePath, null)
    if (!before) {
      console.error(`refresh-summary: before snapshot not found at ${beforePath}`)
      process.exit(1)
    }
    const after = snapshot()
    fs.writeFileSync(bodyOutPath, summaryBody(before, after, process.env))

    const today = new Date().toISOString().slice(0, 10)
    const outputs = [
      `feed_after=${after.feed_version}`,
      `today=${today}`,
      `generated_at=${after.generated_at ?? ""}`,
    ]
    process.stdout.write(outputs.join("\n") + "\n")
    return
  }

  console.error("usage: refresh-summary.ts --capture <outPath>")
  console.error("       refresh-summary.ts --summary <beforePath> <bodyOutPath>")
  process.exit(1)
}

main()
