#!/usr/bin/env bash
# Extracts a Metro Vancouver subset of the Protomaps daily PMTiles build into
# public/data/basemap.pmtiles so the dev map can load the base tiles locally
# (the public build bucket is not CORS-enabled for browsers).
#
# Requires the `pmtiles` CLI: `brew install pmtiles`.
#
# The bounding box covers Metro Vancouver + the WCE corridor out to Mission.
# Zoom capped at 14 to keep the file small; drop or raise if we need more detail.
#
# Production should swap VITE_PMTILES_URL to point at an R2-hosted archive; this
# script is for dev only.

set -euo pipefail

# Pick up the CI-downloaded pmtiles binary (see install-pmtiles-cli.sh) if a
# system-level one isn't already on PATH.
export PATH="./bin:$PATH"

BBOX="-123.5,48.95,-122.2,49.55"
MAXZOOM=14
OUTPUT="public/data/basemap.pmtiles"

# Fetch the latest v4 daily build key from Protomaps' metadata endpoint.
BUILDS_URL="https://build-metadata.protomaps.dev/builds.json"
LATEST_KEY=$(
  curl -fsSL "$BUILDS_URL" |
    node -e '
      const builds = JSON.parse(require("fs").readFileSync(0, "utf8"));
      const v4 = builds.filter((b) => (b.version || "").startsWith("4."));
      if (!v4.length) throw new Error("no v4 builds in metadata");
      console.log(v4[v4.length - 1].key);
    '
)

SOURCE_URL="https://build.protomaps.com/${LATEST_KEY}"
echo "Extracting ${SOURCE_URL} bbox=${BBOX} maxzoom=${MAXZOOM} -> ${OUTPUT}"

mkdir -p "$(dirname "$OUTPUT")"
rm -f "$OUTPUT"

pmtiles extract \
  "$SOURCE_URL" \
  "$OUTPUT" \
  --bbox="$BBOX" \
  --maxzoom="$MAXZOOM" \
  --download-threads=4
