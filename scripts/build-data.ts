import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { pipeline } from 'node:stream/promises'

const GTFS_URL = 'https://gtfs-static.translink.ca/gtfs/google_transit.zip'
const CACHE_DIR = path.resolve(import.meta.dirname, '..', '.cache')
const CACHE_FILE = path.join(CACHE_DIR, 'gtfs.zip')

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

async function main() {
  await downloadGtfs()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
