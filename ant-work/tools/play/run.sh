#!/bin/bash
# hold W the whole way, sprint while I have stamina (like holding shift and letting go when out of breath), steer to x=0
E(){ curl -s --get localhost:7777/eval --data-urlencode "js=$1"; }
for i in $(seq 1 200); do
  r=$(E "(()=>{ PLAYER.yaw=Math.atan2(PLAYER.pos.x*.15,1)*1; const near=Math.min(...[LEVELS.town.steve,LEVELS.town.alex].concat(RUN.guards).map(g=>g.position.distanceTo(V3(PLAYER.pos.x,0,PLAYER.pos.z)))); return PLAYER.pos.z.toFixed(0)+' st '+PLAYER.stamina.toFixed(2)+' near '+near.toFixed(1)+' caught '+RUN.caught+' on '+RUN.on })()")
  echo "$r" | grep -q "on false" && { echo "END: $r"; break; }
  [ $((i%5)) = 0 ] && echo "$r"
  st=$(echo "$r" | awk '{print $3}'); if awk "BEGIN{exit !($st>.15)}"; then curl -s "localhost:7777/keys?k=KeyW,ShiftLeft&ms=800&shot=0" >/dev/null; else curl -s "localhost:7777/key?k=KeyW&ms=800&shot=0" >/dev/null; fi
done
curl -s localhost:7777/state | grep -o '"obj":"[^"]*"\|"move":[a-z]*\|"lv":"[^"]*"' | tr '\n' ' '
