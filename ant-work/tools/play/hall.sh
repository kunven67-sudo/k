#!/bin/bash
# cross each drip lane only right after a drop has landed (like a player watching the shadows)
for dx in 105 142 176; do ./walkto.sh $((dx-7)) 6 1.5 >/dev/null
  for i in $(seq 1 30); do r=$(curl -s --get "localhost:7777/eval" --data-urlencode "js=(()=>{ const d=HAZ.drips.find(o=>o.x===$dx); return d&&!d.m&&d.t>1.2?'GO':'WAIT'; })()"); [ "$r" = "GO" ] && break; sleep .3; done
  curl -s --get "localhost:7777/eval" --data-urlencode "js=(PLAYER.yaw=-Math.PI/2,1)" >/dev/null; curl -s "localhost:7777/keys?k=KeyW,ShiftLeft&ms=1800&shot=0" | grep -o '"pos":\[[^]]*\]'; done
./walkto.sh 205 8 2; ./walkto.sh 218 5 2; curl -s "localhost:7777/state" | grep -o '"cp":"[^"]*"\|"obj":"[^"]*"'
