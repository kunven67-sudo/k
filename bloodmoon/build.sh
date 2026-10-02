#!/bin/bash
# Builds bloodmoon/index.html (a complete standalone page) from src/.
# three.js (MIT, vendor/three.min.js) is inlined so the game works offline.
# Pass a path as the first argument to also write a body-only copy for publishing
# as a Claude artifact (the publisher adds the doctype/head/body wrapper itself).
set -e
D=$(cd "$(dirname "$0")" && pwd)
S=$D/src
js() { for f in "$S"/[1-9]*.js; do cat "$f"; echo; done; }
three() { echo '<script>'; cat "$D/vendor/three.min.js"; echo; echo '</script>'; }
{
  echo '<!DOCTYPE html>'
  echo '<html lang="en">'
  echo '<head>'
  echo '<meta charset="utf-8">'
  echo '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
  cat "$S/00_head.html"
  echo '</head>'
  echo '<body>'
  cat "$S/01_body.html"
  three
  echo '<script>'
  js
  echo '</script>'
  echo '</body>'
  echo '</html>'
} > "$D/index.html"
if [ -n "$1" ]; then
  { cat "$S/00_head.html"; cat "$S/01_body.html"; three; echo '<script>'; js; echo '</script>'; } > "$1"
fi
echo "built $D/index.html ($(wc -c < "$D/index.html") bytes)"
