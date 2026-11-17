#!/bin/bash
# squish.sh secs : aim at the ant closest to the food and click, like a player at the table
E(){ curl -s --get localhost:7777/eval --data-urlencode "js=$1"; }
end=$((SECONDS+${1:-60}))
while [ $SECONDS -lt $end ]; do
  r=$(E "(()=>{ if(!FAKE.on) return 'OFF'; const A=FAKE.ants.filter(a=>!a.dead).sort((a,b)=>a.o.position.distanceTo(STAND.food)-b.o.position.distanceTo(STAND.food))[0]; if(!A) return 'NONE'; const d=A.o.position.clone().sub(camera.position); PLAYER.yaw=Math.atan2(-d.x,-d.z); PLAYER.pitch=Math.atan2(d.y,Math.hypot(d.x,d.z)); return 'AIM' })()")
  if [ "$r" = AIM ]; then sleep .05; curl -s "localhost:7777/click?shot=0" >/dev/null; elif [ "$r" = OFF ]; then s=$(curl -s localhost:7777/state); echo "$s" | grep -q '"dlg":true' && curl -s "localhost:7777/press?k=Enter&shot=0" >/dev/null; echo "$s" | grep -q '"choice":true' && { echo CHOICE; break; }; sleep .3; else sleep .2; fi
done
E "'day '+FAKE.day+' reached '+FAKE.reached+' on '+FAKE.on"; echo; curl -s localhost:7777/state | grep -o '"obj":"[^"]*"\|"cp":"[^"]*"\|"lv":"[^"]*"' | tr '\n' ' '
