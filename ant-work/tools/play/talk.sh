#!/bin/bash
# talk.sh npcId "opt1" "opt2" ... : walk up, look at them, E, then pick each option whose text contains the string (Enter through lines), then Bye
E(){ curl -s --get localhost:7777/eval --data-urlencode "js=$1"; }
id=$1; shift
xz=$(E "(()=>{const p=NPC.$id.position; return p.x.toFixed(1)+' '+p.z.toFixed(1)})()"); set -- $xz "$@"; x=$1; z=$2; shift 2
./walkto.sh $x $z 1.9 | tail -1
./lookE.sh "headOf(NPC.$id)" 
for want in "$@" Bye; do for i in $(seq 1 120); do s=$(curl -s localhost:7777/state)
    if echo "$s" | grep -q '"choice":true'; then idx=$(echo "$s" | python3 -c "import sys,json; c=json.load(sys.stdin)['choices']; w=sys.argv[1]; print(next((i+1 for i,t in enumerate(c) if w.lower() in t.lower()),0))" "$want")
      echo "choices: $(echo "$s" | grep -o '"choices":\[[^]]*\]' | cut -c1-200) -> $want=$idx"; [ "$idx" = 0 ] && { curl -s "localhost:7777/press?k=Escape&shot=0" >/dev/null; break 2; }
      curl -s "localhost:7777/press?k=Digit$idx&shot=0" >/dev/null; sleep .4; break; fi
    echo "$s" | grep -q '"dlg":true' && curl -s "localhost:7777/press?k=Enter&shot=0" >/dev/null; echo "$s" | grep -q '"move":true' && [ $i -gt 8 ] && break; sleep .25; done; done
curl -s localhost:7777/state | grep -o '"obj":"[^"]*"\|"move":[a-z]*' | tr '\n' ' '; echo
