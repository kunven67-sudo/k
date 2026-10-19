#!/bin/sh
# Re-imports every mod into its own folder build/mods/<pack id>/ (PRIVATE build only, git-ignored),
# then packs it (tools/pack_assets.py --packs <id> -> fnf2/build/packs/<id>.head.js + .body.js + index.js).
#   sh tools/packs.sh [pack ids...]      (default: all of them)
cd "$(dirname "$0")/.." || exit 1
set -e
run() {   # run <pack id> <import tool>
  echo "== $1"
  rm -rf "build/mods/$1"
  FNF_OWN="$PWD/build/mods/$1" python3 "tools/own/$2.py" && python3 tools/pack_assets.py --packs "$1"
}
for id in ${*:-garcello tabi sky nene darnell whitty}; do
  case $id in
    garcello) run garcello garcello ;;
    tabi) run tabi tabi ;;
    sky) run sky sky ;;
    nene) run nene nene ;;
    darnell) run darnell darnell_mix ;;
    whitty) run whitty whitty ;;
    *) echo "no such pack: $id"; exit 1 ;;
  esac
done
