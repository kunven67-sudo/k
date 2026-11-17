#!/bin/bash
# I watch each drip lane's shadow and cross when it's clear (sprint), like a player would
E(){ curl -s --get localhost:7777/eval --data-urlencode "js=$1"; }
st(){ curl -s "localhost:7777/state" | grep -o '"pos":\[[^]]*\]\|"move":[a-z]*\|"cp":"[^"]*"' | tr '\n' ' '; echo; }
for lane in 105 142 176; do z=0; [ $lane = 176 ] && z=-4
  ./walkto.sh $((lane-9)) $z 1.5 >/dev/null; st
  for i in $(seq 1 40); do r=$(E "(()=>{ const d=HAZ.drips.find(o=>o.x===$lane); if(!d) return 'GO'; if(d.m) return 'WAIT'; return d.t>1.4?'GO':'WAIT'; })()"); [ "$r" = GO ] && break; sleep .15; done
  echo "lane $lane: $r after $i"; E "(PLAYER.yaw=-Math.PI/2,1)" >/dev/null
  s=$(curl -s "localhost:7777/keys?k=KeyW,ShiftLeft&ms=3000&shot=0"); echo "$s" | grep -q '"move":false' && { echo DIED; st; exit; }; st
done
./walkto.sh 206 0 2; st
