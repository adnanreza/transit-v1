import { describe, expect, it } from "vitest"
import {
  fmtBytes,
  fmtCountDelta,
  fmtDelta,
  refreshHeadline,
  runLink,
  summaryBody,
  type RefreshSnapshot,
} from "./refresh-format.ts"

function snap(overrides: Partial<RefreshSnapshot> = {}): RefreshSnapshot {
  return {
    feed_version: "aa00aa00aa00",
    generated_at: "2026-04-11T00:00:00.000Z",
    route_count: 240,
    ftn_count: 2,
    frequencies_size: 90_000,
    routes_size: 550_000,
    stops_size: 200_000,
    ...overrides,
  }
}

describe("fmtBytes", () => {
  it("renders bytes < 1 KB as raw bytes", () => {
    expect(fmtBytes(0)).toBe("0 B")
    expect(fmtBytes(512)).toBe("512 B")
    expect(fmtBytes(1023)).toBe("1023 B")
  })

  it("renders KB with one decimal once past 1024 B", () => {
    expect(fmtBytes(1024)).toBe("1.0 KB")
    expect(fmtBytes(1536)).toBe("1.5 KB")
  })

  it("renders MB with two decimals once past 1024 KB", () => {
    expect(fmtBytes(1024 * 1024)).toBe("1.00 MB")
    expect(fmtBytes(Math.round(2.5 * 1024 * 1024))).toBe("2.50 MB")
  })
})

describe("fmtDelta", () => {
  it("returns 'no change' for zero delta (distinct from '0 B') to read well in a table cell", () => {
    expect(fmtDelta(100, 100)).toBe("no change")
  })

  it("uses an ASCII plus for positive growth", () => {
    expect(fmtDelta(1024, 2048)).toBe("+1.0 KB")
  })

  it("uses a minus sign (not hyphen) for shrinkage so the sign reads cleanly", () => {
    // U+2212 minus sign, not a hyphen-minus
    expect(fmtDelta(2048, 1024)).toBe("\u22121.0 KB")
  })
})

describe("fmtCountDelta", () => {
  it("returns the after count alone when unchanged", () => {
    expect(fmtCountDelta(240, 240)).toBe("240")
  })

  it("formats a growth as 'after (+diff)'", () => {
    expect(fmtCountDelta(238, 240)).toBe("240 (+2)")
  })

  it("formats a shrink as 'after (−diff)' with a minus sign", () => {
    expect(fmtCountDelta(240, 237)).toBe("237 (\u22123)")
  })
})

describe("refreshHeadline", () => {
  it("announces a feed version bump when feed_version differs", () => {
    const h = refreshHeadline(
      snap({ feed_version: "aa00" }),
      snap({ feed_version: "bb11" }),
    )
    expect(h).toContain("aa00")
    expect(h).toContain("bb11")
    expect(h).toMatch(/bumped/i)
  })

  it("distinguishes content drift when the feed version held but counts changed", () => {
    const h = refreshHeadline(
      snap({ route_count: 240 }),
      snap({ route_count: 241 }),
    )
    expect(h).toMatch(/regeneration produced different data/)
    expect(h).toContain(snap().feed_version)
  })

  it("flags a no-content-change run as 'consider closing' so reviewers don't merge empty PRs", () => {
    const h = refreshHeadline(snap(), snap())
    expect(h).toMatch(/meta\.json/)
    expect(h).toMatch(/Consider closing/)
  })
})

describe("runLink", () => {
  it("renders a real link when all three workflow env vars are present", () => {
    expect(
      runLink({
        GITHUB_SERVER_URL: "https://github.com",
        GITHUB_REPOSITORY: "adnanreza/transit-v1",
        GITHUB_RUN_ID: "123",
      }),
    ).toBe("[Actions run](https://github.com/adnanreza/transit-v1/actions/runs/123)")
  })

  it("falls back to a literal placeholder when env vars aren't set (local smoke-tests)", () => {
    expect(runLink({})).toContain("unavailable")
  })

  it("treats any single missing env var as not-in-Actions", () => {
    expect(
      runLink({
        GITHUB_SERVER_URL: "https://github.com",
        GITHUB_REPOSITORY: "adnanreza/transit-v1",
        // missing GITHUB_RUN_ID
      }),
    ).toContain("unavailable")
  })
})

describe("summaryBody", () => {
  it("produces a valid markdown table with feed/metrics rows and a trailing link line", () => {
    const body = summaryBody(
      snap({ feed_version: "aa00", route_count: 238, ftn_count: 1 }),
      snap({ feed_version: "bb11", route_count: 240, ftn_count: 2 }),
      {
        GITHUB_SERVER_URL: "https://github.com",
        GITHUB_REPOSITORY: "adnanreza/transit-v1",
        GITHUB_RUN_ID: "42",
      },
    )
    expect(body).toMatch(/^## Weekly GTFS refresh/)
    // Table has the expected rows in order
    expect(body).toMatch(/\| Feed version \| `aa00` \| `bb11` \|/)
    expect(body).toMatch(/\| Route count \| 238 \| 240 \(\+2\) \|/)
    expect(body).toMatch(/\| FTN-qualifying \| 1 \| 2 \(\+1\) \|/)
    // Footer link pulls the Actions run URL from env
    expect(body).toMatch(/actions\/runs\/42/)
  })

  it("reads cleanly when the before snapshot is missing (first-ever run)", () => {
    const before = snap({
      feed_version: "(none)",
      route_count: 0,
      ftn_count: 0,
      frequencies_size: 0,
      routes_size: 0,
      stops_size: 0,
    })
    const body = summaryBody(before, snap())
    expect(body).toMatch(/Feed bumped from \*\*\(none\)\*\* to \*\*aa00aa00aa00\*\*/)
    expect(body).toMatch(/\| Route count \| 0 \| 240 \(\+240\) \|/)
  })
})
