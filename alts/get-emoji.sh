#!/bin/bash
# Builds ui/emoji.txt (emoji <tab> name <tab> group) from Unicode's emoji-test.txt (only emoji Windows can draw).
set -e
cd "$(dirname "$0")"
curl -fsS https://unicode.org/Public/emoji/latest/emoji-test.txt | awk -F'#' '
  /^# group:/ { g=$0; sub(/^# group: /,"",g); next }
  /^[0-9A-F]/ && /; fully-qualified/ && !/skin tone/ {
    split($2, a, " "); e=a[1]; v=a[2]; sub(/^E/,"",v); if (v+0 > 15.0) next; n=$2; sub(/^ *[^ ]+ +E[0-9.]+ +/,"",n); print e "\t" n "\t" g
  }' > ui/emoji.txt
echo "emoji: $(wc -l < ui/emoji.txt)"
