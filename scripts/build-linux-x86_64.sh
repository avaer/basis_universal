#!/usr/bin/env bash
set -euo pipefail

# Minimal cross-compile to Linux x86_64 via Docker, without changing defaults.
# Produces: bin/linux-x86_64/basisu (and examples)

ROOT_DIR="$(cd "$(dirname "$0")"/.. && pwd)"
BUILD_DIR="$ROOT_DIR/build-linux"
OUT_DIR="$ROOT_DIR/bin/linux-x86_64"

echo "[info] Root: $ROOT_DIR"
echo "[info] Build dir: $BUILD_DIR"
echo "[info] Output dir: $OUT_DIR"

mkdir -p "$OUT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "[error] Docker is required. Install Docker Desktop and retry." >&2
  exit 1
fi

# Preserve any existing host binaries so we don't break local usage
HOST_BASISU="$ROOT_DIR/bin/basisu"
HOST_EXAMPLES="$ROOT_DIR/bin/examples"
RESTORE_BASISU=false
RESTORE_EXAMPLES=false

if [ -f "$HOST_BASISU" ]; then
  mv "$HOST_BASISU" "$HOST_BASISU.macos" && RESTORE_BASISU=true
fi
if [ -f "$HOST_EXAMPLES" ]; then
  mv "$HOST_EXAMPLES" "$HOST_EXAMPLES.macos" && RESTORE_EXAMPLES=true
fi

cleanup() {
  # Move Linux outputs to linux-x86_64/ and restore host binaries
  if [ -f "$ROOT_DIR/bin/basisu" ]; then
    mv -f "$ROOT_DIR/bin/basisu" "$OUT_DIR/basisu"
    echo "[info] Wrote $OUT_DIR/basisu"
  fi
  if [ -f "$ROOT_DIR/bin/examples" ]; then
    mv -f "$ROOT_DIR/bin/examples" "$OUT_DIR/examples" || true
    echo "[info] Wrote $OUT_DIR/examples"
  fi

  if [ "$RESTORE_BASISU" = true ] && [ -f "$HOST_BASISU.macos" ]; then
    mv -f "$HOST_BASISU.macos" "$HOST_BASISU"
  fi
  if [ "$RESTORE_EXAMPLES" = true ] && [ -f "$HOST_EXAMPLES.macos" ]; then
    mv -f "$HOST_EXAMPLES.macos" "$HOST_EXAMPLES"
  fi
}
trap cleanup EXIT

# Build inside an amd64 Linux container
DOCKER_IMAGE="ubuntu:22.04"

docker run --rm \
  --platform=linux/amd64 \
  -v "$ROOT_DIR":"$ROOT_DIR" \
  -w "$ROOT_DIR" \
  "$DOCKER_IMAGE" \
  bash -lc "set -euo pipefail; \
    export DEBIAN_FRONTEND=noninteractive; \
    apt-get update -qq; \
    apt-get install -y -qq cmake build-essential pkg-config git ca-certificates > /dev/null; \
    cmake -S . -B '$BUILD_DIR' -DCMAKE_BUILD_TYPE=Release; \
    cmake --build '$BUILD_DIR' --config Release -j \
  "

echo "[done] Linux x86_64 build complete. Binaries in: $OUT_DIR"


