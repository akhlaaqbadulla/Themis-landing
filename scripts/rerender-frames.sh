#!/usr/bin/env bash
# Re-render the Gates-of-Olympus scrollytelling frames at hi-DPI.
#
# Usage:
#   ./scripts/rerender-frames.sh <source> [target-height]
#
#   <source>         MP4 file, or directory of PNG/JPG frames (any count, any res)
#   [target-height]  output WebP height. Defaults to 1440 (2.5K). Use 2160 for 4K.
#
# Output: 192 WebP frames written to GatesWebP/00001.webp … GatesWebP/00192.webp,
#         aspect 16:9, quality q=82, each <= ~200 KB at 1440 / ~380 KB at 2160.
#
# Runs entirely inside a throwaway Docker container — no host install of
# ffmpeg/cwebp required. The script also writes to a staging folder and only
# swaps GatesWebP/ at the end, so a partial/failed run can't leave the live
# site with a mix of old and new frames.
#
# Why 192 frames specifically: the scrollytelling JS is keyed to exactly 192
# frames numbered 00001..00192. Don't change the count unless you also update
# the TOTAL constant in index.html.

set -euo pipefail

SRC="${1:-}"
H="${2:-1440}"

if [[ -z "$SRC" || ! -e "$SRC" ]]; then
  echo "Usage: $0 <source-mp4-or-frames-dir> [height=1440|2160]" >&2
  exit 2
fi

case "$H" in
  1440|2160) ;;
  *) echo "Only 1440 or 2160 supported (got $H)" >&2; exit 2 ;;
esac

W=$(( H * 16 / 9 ))
COUNT=192
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAGE="$ROOT/GatesWebP.new"
DEST="$ROOT/GatesWebP"

rm -rf "$STAGE"
mkdir -p "$STAGE"

IMAGE="linuxserver/ffmpeg:latest"
echo "Pulling $IMAGE (one-time) ..."
docker pull "$IMAGE" >/dev/null

if [[ -d "$SRC" ]]; then
  # ── Frames directory path ────────────────────────────────
  SRC_ABS="$(cd "$SRC" && pwd)"
  # Count inputs so we know the stride
  SRC_COUNT=$(find "$SRC_ABS" \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.webp' \) | wc -l)
  if (( SRC_COUNT == 0 )); then
    echo "No image files found in $SRC_ABS" >&2; exit 1
  fi
  echo "Source: $SRC_COUNT frames in $SRC_ABS → $COUNT frames at ${W}x${H}"
  # Use a glob pattern — ffmpeg will sort lexicographically
  docker run --rm \
    -v "$SRC_ABS":/in:ro \
    -v "$STAGE":/out \
    --entrypoint /bin/sh \
    "$IMAGE" -c "
      set -e
      ffmpeg -y -framerate 30 -pattern_type glob -i '/in/*.png' \
        -vf 'scale=${W}:${H}:flags=lanczos,thumbnail=1,fps=fps=30' -frames:v ${COUNT} \
        -c:v libwebp -quality 82 -lossless 0 \
        /out/%05d.webp 2>/dev/null || \
      ffmpeg -y -framerate 30 -pattern_type glob -i '/in/*.jpg' \
        -vf 'scale=${W}:${H}:flags=lanczos,fps=fps=30' -frames:v ${COUNT} \
        -c:v libwebp -quality 82 -lossless 0 \
        /out/%05d.webp
    "
else
  # ── MP4 path ─────────────────────────────────────────────
  SRC_ABS="$(cd "$(dirname "$SRC")" && pwd)/$(basename "$SRC")"
  DUR=$(docker run --rm -v "$(dirname "$SRC_ABS")":/in:ro --entrypoint ffprobe "$IMAGE" \
    -v error -show_entries format=duration -of csv=p=0 "/in/$(basename "$SRC_ABS")")
  FPS=$(awk -v c="$COUNT" -v d="$DUR" 'BEGIN { printf "%.6f", c/d }')
  echo "Source: $(basename "$SRC_ABS") (${DUR}s) → $COUNT frames at ${W}x${H} @ ${FPS} fps"
  docker run --rm \
    -v "$(dirname "$SRC_ABS")":/in:ro \
    -v "$STAGE":/out \
    "$IMAGE" \
      -y -i "/in/$(basename "$SRC_ABS")" \
      -vf "fps=${FPS},scale=${W}:${H}:flags=lanczos" \
      -frames:v "$COUNT" \
      -c:v libwebp -quality 82 -lossless 0 \
      /out/%05d.webp
fi

# Sanity check: did we actually get 192 outputs?
GOT=$(ls -1 "$STAGE"/*.webp 2>/dev/null | wc -l)
if (( GOT != COUNT )); then
  echo "Expected $COUNT frames, got $GOT — aborting, not swapping" >&2
  echo "Partial output left in $STAGE for inspection."
  exit 1
fi

# Atomic swap
if [[ -d "$DEST" ]]; then
  mv "$DEST" "${DEST}.old-$(date +%s)"
fi
mv "$STAGE" "$DEST"

TOTAL_KB=$(du -sk "$DEST" | awk '{print $1}')
echo
echo "✓ $COUNT frames written to $DEST (${W}x${H}, ${TOTAL_KB}KB total)"
echo "  Previous frames (if any) preserved at ${DEST}.old-*"
echo "  Next: docker compose build && docker compose up -d"
