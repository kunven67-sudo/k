#!/bin/bash
# pick.sh N secs : press Enter through dialogue; the moment a choice shows, press option N
end=$((SECONDS+${2:-60}))
while [ $SECONDS -lt $end ]; do s=$(curl -s localhost:7777/state); 
  if echo "$s" | grep -q '"choice":true'; then curl -s "localhost:7777/press?k=Digit$1&shot=0" >/dev/null; echo "picked $1"; break; fi
  echo "$s" | grep -q '"dlg":true' && curl -s "localhost:7777/press?k=Enter&shot=0" >/dev/null; sleep .25; done
