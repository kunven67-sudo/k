#!/usr/bin/env bash
# Builds every game asset from source, into public/assets (or $1).
#   tools/build_assets.sh [out dir]
# Needs: python with bpy (Blender as a module), git, and network to GitHub.
#   - humans + animations: Microsoft Rocketbox (MIT), converted with Blender
#   - textures, HDRIs, props: Poly Haven (CC0), from the th-assets branch
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
OUT="${1:-$ROOT/public/assets}"
WORK="${WORK:-$ROOT/.asset-work}"
PY="${BLENDER_PY:-python3}"
JOBS="${JOBS:-3}"
mkdir -p "$OUT/avatars" "$OUT/anims" "$WORK"

# ---- Rocketbox source (sparse, only what we use)
RB="$WORK/rocketbox"
if [ ! -d "$RB/.git" ]; then
  git clone --filter=blob:none --no-checkout --depth 1 https://github.com/microsoft/Microsoft-Rocketbox "$RB"
fi
{
  echo "/Assets/Animations/"
  sed -e 's#^#/Assets/Avatars/#' -e 's#$#/#' "$HERE/avatars.txt"
} > "$RB/.git/info/sparse-checkout"
git -C "$RB" config core.sparseCheckout true
git -C "$RB" checkout -q HEAD

# ---- avatars (one Blender run each, in parallel)
grep -v '^\s*#' "$HERE/avatars.txt" | grep -v '^\s*$' | while read -r a; do
  echo "$a"
done | xargs -P "$JOBS" -I{} sh -c '
  name=$(basename "{}")
  out="'"$OUT"'/avatars/$name.glb"
  [ -s "$out" ] && exit 0
  "'"$PY"'" "'"$HERE"'/convert_avatar.py" -- "'"$RB"'/Assets/Avatars/{}" "$out" > "'"$WORK"'/$name.log" 2>&1 || { echo "FAILED avatar $name"; tail -20 "'"$WORK"'/$name.log"; exit 1; }
  echo "avatar $name $(stat -c %s "$out")"
'

# ---- animations (one file per clip; 20 clips per Blender run)
ls "$RB"/Assets/Animations/all_animations_max_motextr_{static,xy,xyz}/*.fbx > "$WORK/anims.txt"
xargs -d '\n' -n 20 -P "$JOBS" -a "$WORK/anims.txt" "$PY" "$HERE/convert_anims.py" -- "$OUT/anims" | grep -E '^(CLIP|NO ANIM)' | tail -n 3 || true
echo "animations: $(ls "$OUT/anims" | wc -l) clips"

# ---- manifest the game reads (names only; files load on demand)
python3 - "$OUT" <<'PY'
import json, os, sys
out = sys.argv[1]
man = {
  'avatars': sorted(f[:-4] for f in os.listdir(os.path.join(out, 'avatars')) if f.endswith('.glb')),
  'anims': sorted(f[:-4] for f in os.listdir(os.path.join(out, 'anims')) if f.endswith('.glb')),
}
json.dump(man, open(os.path.join(out, 'manifest.json'), 'w'), indent=0)
print('manifest:', {k: len(v) for k, v in man.items()})
PY
