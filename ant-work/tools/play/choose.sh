#!/bin/bash
# choose.sh "opt1" "opt2" ... : already in a conversation; pick each option containing the text (Enter through lines), then Bye
for want in "$@" Bye; do for i in $(seq 1 120); do s=$(curl -s localhost:7777/state)
    if echo "$s" | grep -q '"choice":true'; then idx=$(echo "$s" | python3 -c "import sys,json; c=json.load(sys.stdin)['choices']; w=sys.argv[1]; print(next((i+1 for i,t in enumerate(c) if w.lower() in t.lower()),0))" "$want")
      echo "-> $want=$idx  ($(echo "$s" | grep -o '"choices":\[[^]]*\]' | cut -c11-180))"; [ "$idx" = 0 ] && break 2; curl -s "localhost:7777/press?k=Digit$idx&shot=0" >/dev/null; sleep .4; break; fi
    echo "$s" | grep -q '"dlg":true' && curl -s "localhost:7777/press?k=Enter&shot=0" >/dev/null; echo "$s" | grep -q '"move":true' && [ $i -gt 8 ] && break; sleep .25; done; done
curl -s localhost:7777/state | grep -o '"obj":"[^"]*"\|"move":[a-z]*' | tr '\n' ' '; echo
