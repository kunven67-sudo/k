#!/bin/bash
# walkto.sh x z [stopdist] : I steer toward x,z (like moving the mouse), holding W in short steps; prints where I end up
x=$1; z=$2; r=${3:-1.5}
for i in $(seq 1 25); do d=$(curl -s --get "localhost:7777/eval" --data-urlencode "js=(()=>{ const dx=$x-PLAYER.pos.x, dz=$z-PLAYER.pos.z; PLAYER.yaw=Math.atan2(-dx,-dz); return Math.hypot(dx,dz).toFixed(1); })()"); 
  awk "BEGIN{exit !($d<$r)}" && { echo "arrived $d"; break; }; s=$(curl -s "localhost:7777/key?k=KeyW&ms=900&shot=0"); echo "$s" | grep -q '"move":false' && { echo "LOCKED $(echo $s | grep -o '"sub":"[^"]\{0,60\}')"; break; }; done
curl -s "localhost:7777/state" | grep -o '"pos":\[[^]]*\]\|"obj":"[^"]\{0,50\}'
