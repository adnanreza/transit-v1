#!/usr/bin/env bash
# Installs the `pmtiles` CLI to ./bin/pmtiles on Linux CI runners (Netlify's
# build env is Ubuntu x86_64). On macOS / elsewhere it assumes the developer
# has already installed it via `brew install pmtiles` and is a no-op.
#
# Pins a specific `go-pmtiles` release so Netlify builds are reproducible.
# Bump intentionally when you want the new version.

set -euo pipefail

VERSION="1.30.1"
BIN_DIR="./bin"
TARGET="${BIN_DIR}/pmtiles"

# Skip if a suitable `pmtiles` is already discoverable — dev machines (macOS
# brew, Homebrew on Linux) or prior runs of this script both count.
if command -v pmtiles >/dev/null 2>&1; then
  echo "install-pmtiles-cli: pmtiles found on PATH ($(command -v pmtiles)); skipping download."
  exit 0
fi

if [[ -x "$TARGET" ]]; then
  echo "install-pmtiles-cli: ${TARGET} already present; skipping download."
  exit 0
fi

# Only fetch a binary automatically on Linux; bail with a friendly message on
# anything else so macOS devs don't end up with a Linux binary.
OS=$(uname -s)
if [[ "$OS" != "Linux" ]]; then
  echo "install-pmtiles-cli: auto-install is Linux-only (detected ${OS})." >&2
  echo "  On macOS, run: brew install pmtiles" >&2
  exit 1
fi

ARCH=$(uname -m)
case "$ARCH" in
  x86_64) ASSET_ARCH="x86_64" ;;
  aarch64 | arm64) ASSET_ARCH="arm64" ;;
  *)
    echo "install-pmtiles-cli: unsupported arch ${ARCH}" >&2
    exit 1
    ;;
esac

ASSET="go-pmtiles_${VERSION}_Linux_${ASSET_ARCH}.tar.gz"
URL="https://github.com/protomaps/go-pmtiles/releases/download/v${VERSION}/${ASSET}"

echo "install-pmtiles-cli: downloading ${ASSET}"
mkdir -p "$BIN_DIR"
tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT

curl -fsSL "$URL" | tar -xz -C "$tmpdir"
mv "$tmpdir/pmtiles" "$TARGET"
chmod +x "$TARGET"

echo "install-pmtiles-cli: installed pmtiles ${VERSION} at ${TARGET}"
