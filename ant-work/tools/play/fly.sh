#!/bin/bash
# fly.sh id : fly toward glass box id (aim camera at it + W), stop near, press E
id=$1
E(){ curl -s --get localhost:7777/eval --data-urlencode "js=$1"; }
for i in $(seq 1 40); do r=$(E "(()=>{ const g=LEVELS.white.boxes['$id']; const p=g.position.clone().add(V3(0,0,g.userData.S*.8)); const d=p.clone().sub(camera.position); PLAYER.yaw=Math.atan2(-d.x,-d.z); PLAYER.pitch=Math.atan2(d.y,Math.hypot(d.x,d.z)); return d.length().toFixed(1)+' '+(PLAYER.y||0).toFixed(1); })()"); set -- $r; awk "BEGIN{exit !($1<2.5)}" && break; curl -s "localhost:7777/key?k=KeyW&ms=$(awk "BEGIN{print ($1>25)?500:(($1>8)?180:70)}")&shot=0" >/dev/null; done
echo "near $id: $r"; E "(()=>{ const g=LEVELS.white.boxes['$id']; const d=g.position.clone().sub(camera.position); PLAYER.yaw=Math.atan2(-d.x,-d.z); PLAYER.pitch=Math.atan2(d.y,Math.hypot(d.x,d.z)); return 1; })()" >/dev/null; sleep .4
curl -s localhost:7777/state | grep -o '"prompt":"[^"]*"'; curl -s "localhost:7777/press?k=KeyE&shot=0" >/dev/null; sleep 3; for i in $(seq 1 30); do s=$(curl -s localhost:7777/state); echo "$s" | grep -q '"dlg":true' && curl -s "localhost:7777/press?k=Enter&shot=0" >/dev/null; echo "$s" | grep -q '"move":true' && break; sleep .4; done
E "'seen '+Object.keys(F.seen).join(',')"; echo
