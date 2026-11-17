#!/bin/bash
E(){ curl -s --get localhost:7777/eval --data-urlencode "js=$1"; }
st(){ curl -s "localhost:7777/state" | grep -o '"pos":\[[^]]*\]\|"move":[a-z]*' | tr '\n' ' '; echo " cat:$(E "CAT.state+' '+(LV.cat.position.x|0)")"; }
cross(){ lane=$1; z=$2; ms=${3:-2600}; ./walkto.sh $((lane+9)) $z 1.5 >/dev/null; st
  for i in $(seq 1 60); do r=$(E "(()=>{ const d=HAZ.drips.find(o=>o.x===$lane); if(!d) return 'GO'; if(d.m) return 'WAIT'; return d.t>1.4?'GO':'WAIT'; })()"); [ "$r" = GO ] && break; sleep .15; done
  E "(PLAYER.yaw=Math.PI/2,1)" >/dev/null; s=$(curl -s "localhost:7777/keys?k=KeyW,ShiftLeft&ms=$ms&shot=0"); echo "$s" | grep -q '"move":false' && { echo "DIED at lane $lane"; exit 1; }; }
cross 176 -4; ./walkto.sh 150 -5 1.5 >/dev/null; st; cross 142 -5 2100; ./walkto.sh 128 8 1.5 >/dev/null; st; cross 105 0; ./walkto.sh 60 0 2 >/dev/null; st
