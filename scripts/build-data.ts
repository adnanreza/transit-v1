import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { pipeline } from 'node:stream/promises'
import mapshaper from 'mapshaper'
import { parse as parseCsv } from 'csv-parse/sync'
import { openZipEntry, readTextFromZip } from './lib/extract.ts'
import {
  buildShapeToRouteMap,
  collectShapes,
  filterFixedRoutes,
  parseRoutes,
  parseStops,
  parseTrips,
  shapesToRouteGeoJSON,
  stopsToGeoJSON,
  type RouteFeatureCollection,
} from './lib/gtfs.ts'
import {
  dayTypeServiceIds,
  parseCalendar,
  parseCalendarDates,
  pickRepresentativeDates,
} from './lib/calendar.ts'
import {
  computeTripPattern,
  groupTripsByPattern,
  streamTripStopTimes,
  type PatternSummary,
  type TripPatternWithMeta,
} from './lib/patterns.ts'
import {
  computePatternFrequencies,
  parseGtfsTime,
  type PatternTimes,
} from './lib/headways.ts'
import { patternBandAndFtn, routeBandFromPatterns } from './lib/ftn.ts'
import type {
  Band,
  DayType,
  FrequenciesFile,
  PatternFrequency,
  RouteFrequency,
} from './types/frequencies.ts'

const GTFS_URL = 'https://gtfs-static.translink.ca/gtfs/google_transit.zip'
const CACHE_DIR = path.resolve(import.meta.dirname, '..', '.cache')
const CACHE_FILE = path.join(CACHE_DIR, 'gtfs.zip')
const DATA_DIR = path.resolve(import.meta.dirname, '..', 'public', 'data')

async function sha256(filePath: string): Promise<string> {
  const hash = crypto.createHash('sha256')
  await pipeline(fs.createReadStream(filePath), hash)
  return hash.digest('hex')
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

// Simplify route geometries with mapshaper to reduce render load.
// Visvalingam-weighted (the default) preserves shape character well at low
// percentages; `keep-shapes` is a no-op on lines but harmless.
async function simplifyRoutes(
  input: RouteFeatureCollection,
  percentage: number,
): Promise<RouteFeatureCollection> {
  const result = await mapshaper.applyCommands(
    `-i input.geojson -simplify ${percentage}% keep-shapes -o output.geojson format=geojson`,
    { 'input.geojson': JSON.stringify(input) },
  )
  const buf = result['output.geojson']
  if (!buf) throw new Error('mapshaper produced no output')
  return JSON.parse(buf.toString('utf-8')) as RouteFeatureCollection
}

export interface GtfsDownload {
  path: string
  sha256: string
  cached: boolean
  lastModified: string | null
}

export async function downloadGtfs(): Promise<GtfsDownload> {
  fs.mkdirSync(CACHE_DIR, { recursive: true })
  const exists = fs.existsSync(CACHE_FILE)
  const headers: Record<string, string> = {}

  if (exists) {
    const stat = fs.statSync(CACHE_FILE)
    headers['If-Modified-Since'] = stat.mtime.toUTCString()
  }

  const res = await fetch(GTFS_URL, { headers })

  if (res.status === 304 && exists) {
    const hash = await sha256(CACHE_FILE)
    console.log(`Feed not modified; using cached copy (sha256: ${hash.slice(0, 12)}).`)
    return { path: CACHE_FILE, sha256: hash, cached: true, lastModified: null }
  }

  if (!res.ok || !res.body) {
    throw new Error(`Failed to download GTFS: ${res.status} ${res.statusText}`)
  }

  const tmpPath = CACHE_FILE + '.tmp'
  await pipeline(res.body, fs.createWriteStream(tmpPath))
  const newHash = await sha256(tmpPath)
  const lastModified = res.headers.get('last-modified')

  if (exists) {
    const oldHash = await sha256(CACHE_FILE)
    if (oldHash === newHash) {
      fs.unlinkSync(tmpPath)
      console.log(`Feed content unchanged (sha256: ${newHash.slice(0, 12)}).`)
      return { path: CACHE_FILE, sha256: newHash, cached: true, lastModified }
    }
  }

  fs.renameSync(tmpPath, CACHE_FILE)
  const size = fs.statSync(CACHE_FILE).size
  console.log(
    `Downloaded GTFS (${fmtBytes(size)}, sha256: ${newHash.slice(0, 12)}, last-modified: ${lastModified}).`
  )
  return { path: CACHE_FILE, sha256: newHash, cached: false, lastModified }
}

interface Meta {
  feed_version: string
  generated_at: string
  translink_attribution: string
  translink_disclaimer: string
  osm_attribution: string
}

// Attribution strings are verbatim-required by TransLink's license.
// See context/features/02-data-pipeline-foundation.md for the source.
const TRANSLINK_ATTRIBUTION =
  'Route and arrival data used in this product or service is provided by permission of TransLink.'
const TRANSLINK_DISCLAIMER =
  'TransLink assumes no responsibility for the accuracy or currency of the Data used in this product or service.'
const OSM_ATTRIBUTION = 'Map data © OpenStreetMap contributors'

async function main() {
  const { path: zipPath, sha256: feedSha } = await downloadGtfs()

  const [routesCsv, stopsCsv] = await Promise.all([
    readTextFromZip(zipPath, 'routes.txt'),
    readTextFromZip(zipPath, 'stops.txt'),
  ])

  const routes = filterFixedRoutes(parseRoutes(routesCsv))
  const stops = parseStops(stopsCsv)

  console.log(`Routes (fixed-route only): ${routes.length}`)
  console.log(`Stops: ${stops.length}`)

  const [calendarCsv, calendarDatesCsv, tripsCsv] = await Promise.all([
    readTextFromZip(zipPath, 'calendar.txt'),
    readTextFromZip(zipPath, 'calendar_dates.txt'),
    readTextFromZip(zipPath, 'trips.txt'),
  ])
  const calendar = parseCalendar(calendarCsv)
  const calendarDates = parseCalendarDates(calendarDatesCsv)
  const repDates = pickRepresentativeDates(new Date(), calendar, calendarDates)
  const dayServices = dayTypeServiceIds(repDates, calendar, calendarDates)
  console.log(
    `Representative dates — weekday: ${repDates.weekday.toISOString().slice(0, 10)} ` +
      `(${dayServices.weekday.size} services), ` +
      `saturday: ${repDates.saturday.toISOString().slice(0, 10)} ` +
      `(${dayServices.saturday.size}), ` +
      `sunday: ${repDates.sunday.toISOString().slice(0, 10)} ` +
      `(${dayServices.sunday.size})`,
  )

  const trips = parseTrips(tripsCsv)
  const shapeToRoute = buildShapeToRouteMap(trips, routes)
  console.log(`Shape → route mappings: ${shapeToRoute.size}`)

  const shapesStream = await openZipEntry(zipPath, 'shapes.txt')
  const shapes = await collectShapes(shapesStream, new Set(shapeToRoute.keys()))
  console.log(`Shapes collected: ${shapes.size}`)

  const fixedRouteTrips = new Map(
    trips
      .filter((t) => shapeToRoute.has(t.shape_id))
      .map((t) => [t.trip_id, t]),
  )
  const stopTimesStream = await openZipEntry(zipPath, 'stop_times.txt')
  const tripPatterns: TripPatternWithMeta[] = []
  for await (const trip of streamTripStopTimes(stopTimesStream)) {
    const meta = fixedRouteTrips.get(trip.trip_id)
    if (!meta) continue
    const pattern = computeTripPattern(trip.trip_id, trip.rows)
    tripPatterns.push({
      ...pattern,
      route_id: meta.route_id,
      shape_id: meta.shape_id,
      service_id: meta.service_id,
    })
  }
  const patterns = groupTripsByPattern(tripPatterns)
  console.log(
    `Trips with patterns: ${tripPatterns.length}, unique patterns: ${patterns.size}`,
  )

  // Bucket arrival times per (pattern, day type) and compute headways.
  const patternTimes = new Map<string, PatternTimes>()
  const tripsByIdPattern = new Map(tripPatterns.map((t) => [t.trip_id, t]))
  for (const pattern of patterns.values()) {
    const times: PatternTimes = { weekday: [], saturday: [], sunday: [] }
    for (const tripId of pattern.trip_ids) {
      const t = tripsByIdPattern.get(tripId)
      if (!t) continue
      const timeSec = parseGtfsTime(t.first_arrival_time)
      if (timeSec < 0) continue
      for (const dayType of ['weekday', 'saturday', 'sunday'] as DayType[]) {
        if (dayServices[dayType].has(t.service_id)) {
          times[dayType].push(timeSec)
        }
      }
    }
    patternTimes.set(pattern.pattern_id, times)
  }
  // Compute trip counts per route (for pattern trip_share) and per pattern.
  const tripsPerRoute = new Map<string, number>()
  for (const t of tripPatterns) {
    tripsPerRoute.set(t.route_id, (tripsPerRoute.get(t.route_id) ?? 0) + 1)
  }

  interface PatternWithFrequency {
    summary: PatternSummary
    trip_share: number
    headways: ReturnType<typeof computePatternFrequencies>['headways']
    hourly: ReturnType<typeof computePatternFrequencies>['hourly']
    band: Band
    ftn_qualifies: boolean
    ftn_failure: { day_type: DayType; hour: number } | null
  }

  const patternFrequencies = new Map<string, PatternWithFrequency>()
  for (const [patternId, times] of patternTimes) {
    const summary = patterns.get(patternId)!
    const { headways, hourly } = computePatternFrequencies(times)
    const routeTrips = tripsPerRoute.get(summary.route_id) ?? 1
    const tripShare = summary.trip_ids.length / routeTrips
    const { band, ftn_qualifies, ftn_failure } = patternBandAndFtn(headways, hourly)
    patternFrequencies.set(patternId, {
      summary,
      trip_share: tripShare,
      headways,
      hourly,
      band,
      ftn_qualifies,
      ftn_failure,
    })
  }

  // Derive route-level bands from their patterns.
  const patternsByRoute = new Map<string, PatternWithFrequency[]>()
  for (const p of patternFrequencies.values()) {
    const arr = patternsByRoute.get(p.summary.route_id) ?? []
    arr.push(p)
    patternsByRoute.set(p.summary.route_id, arr)
  }
  const routeBands = new Map<
    string,
    { band: Band; ftn_qualifies: boolean; ftn_failure: { day_type: DayType; hour: number } | null }
  >()
  for (const [routeId, ps] of patternsByRoute) {
    routeBands.set(
      routeId,
      routeBandFromPatterns(
        ps.map((p) => ({
          band: p.band,
          ftn_qualifies: p.ftn_qualifies,
          ftn_failure: p.ftn_failure,
          trip_share: p.trip_share,
        })),
      ),
    )
  }

  // Distribution logging
  const bandCounts: Record<Band, number> = {
    very_frequent: 0,
    frequent: 0,
    standard: 0,
    infrequent: 0,
    peak_only: 0,
    night_only: 0,
  }
  for (const { band } of routeBands.values()) bandCounts[band]++
  const ftnCount = [...routeBands.values()].filter((r) => r.ftn_qualifies).length
  console.log(
    `Route bands: very_frequent=${bandCounts.very_frequent}, frequent=${bandCounts.frequent}, ` +
      `standard=${bandCounts.standard}, infrequent=${bandCounts.infrequent}, ` +
      `peak_only=${bandCounts.peak_only}, night_only=${bandCounts.night_only}`,
  )
  console.log(`FTN-qualifying routes: ${ftnCount} / ${routeBands.size}`)

  // Assemble the frequencies.json output.
  const frequencies: FrequenciesFile = {}
  for (const [routeId, ps] of patternsByRoute) {
    const routeInfo = routeBands.get(routeId)!
    const patterns: PatternFrequency[] = ps
      .slice()
      .sort((a, b) => b.trip_share - a.trip_share)
      .map((p) => ({
        pattern_id: p.summary.pattern_id,
        shape_ids: [...p.summary.shape_ids].sort(),
        representative_stop_id: p.summary.representative_stop_id,
        trip_count: p.summary.trip_ids.length,
        trip_share: Number(p.trip_share.toFixed(4)),
        headways: p.headways,
        hourly: p.hourly,
      }))
    const entry: RouteFrequency = {
      route_id: routeId,
      band: routeInfo.band,
      ftn_qualifies: routeInfo.ftn_qualifies,
      ftn_failure: routeInfo.ftn_failure,
      patterns,
    }
    frequencies[routeId] = entry
  }
  fs.writeFileSync(
    path.join(DATA_DIR, 'frequencies.json'),
    JSON.stringify(frequencies),
  )
  const freqSize = fs.statSync(path.join(DATA_DIR, 'frequencies.json')).size
  console.log(
    `Wrote public/data/frequencies.json (${Object.keys(frequencies).length} routes, ${fmtBytes(freqSize)})`,
  )

  const routesRaw = shapesToRouteGeoJSON(shapes, shapeToRoute)
  const routesSimplified = await simplifyRoutes(routesRaw, 20)
  const rawVerts = countVertices(routesRaw)
  const simplVerts = countVertices(routesSimplified)
  console.log(
    `Simplified routes: ${rawVerts} → ${simplVerts} vertices (${((simplVerts / rawVerts) * 100).toFixed(1)}% kept)`,
  )

  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(
    path.join(DATA_DIR, 'stops.geojson'),
    JSON.stringify(stopsToGeoJSON(stops)),
  )
  const stopsSize = fs.statSync(path.join(DATA_DIR, 'stops.geojson')).size
  console.log(`Wrote public/data/stops.geojson (${stops.length} features, ${fmtBytes(stopsSize)})`)

  fs.writeFileSync(
    path.join(DATA_DIR, 'routes.geojson'),
    JSON.stringify(routesSimplified),
  )
  const routesSize = fs.statSync(path.join(DATA_DIR, 'routes.geojson')).size
  console.log(
    `Wrote public/data/routes.geojson (${routesSimplified.features.length} features, ${fmtBytes(routesSize)})`,
  )

  const meta: Meta = {
    feed_version: await resolveFeedVersion(zipPath, feedSha),
    generated_at: new Date().toISOString(),
    translink_attribution: TRANSLINK_ATTRIBUTION,
    translink_disclaimer: TRANSLINK_DISCLAIMER,
    osm_attribution: OSM_ATTRIBUTION,
  }
  fs.writeFileSync(path.join(DATA_DIR, 'meta.json'), JSON.stringify(meta, null, 2))
  console.log(`Wrote public/data/meta.json (feed_version: ${meta.feed_version})`)
}

// Prefer feed_info.txt's feed_version if the feed ships one; fall back to the
// first 12 hex chars of the zip's SHA-256 for a deterministic version string.
async function resolveFeedVersion(zipPath: string, sha256Hex: string): Promise<string> {
  try {
    const csv = await readTextFromZip(zipPath, 'feed_info.txt')
    const rows = parseCsv(csv, {
      columns: true,
      skip_empty_lines: true,
      bom: true,
    }) as Record<string, string>[]
    const version = rows[0]?.feed_version
    if (version) return version
  } catch {
    // feed_info.txt not present
  }
  return sha256Hex.slice(0, 12)
}

function countVertices(fc: RouteFeatureCollection): number {
  let n = 0
  for (const f of fc.features) n += f.geometry.coordinates.length
  return n
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
