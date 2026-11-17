#!/bin/bash
# I fight: every ~0.3 s look at the bug; if it's winding up an attack and close -> dodge sideways; if far -> step in; else stab (click)
end=$((SECONDS+${1:-120})); n=0
while [ $SECONDS -lt $end ]; do
  s=$(curl -s --get "localhost:7777/eval" --data-urlencode 'js=(()=>{ SLOWMO.target=SLOWMO.k=.15; if(!ARENA.active) return "END "+ARENA.hp; const B=ARENA.bug.userData.bug, p=ARENA.bug.position; const dx=p.x-PLAYER.pos.x, dz=p.z-PLAYER.pos.z; PLAYER.yaw=Math.atan2(-dx,-dz); PLAYER.pitch=-.12; return [Math.hypot(dx,dz).toFixed(1),(B.atkK||0).toFixed(2),ARENA.hp,ARENA.st.hp|0,ARENA.cur].join(" "); })()')
  set -- $s; [ "$1" = "END" ] && { echo "FIGHT OVER, my hp $2"; break; }
  d=$1; atk=$2; n=$((n+1)); [ $((n%10)) -eq 0 ] && echo "dist $d atk $atk myHP $3 bugHP $4 $5"
  if awk "BEGIN{exit !($atk>0.72 && $d<4.6)}"; then k=$([ $((RANDOM%2)) -eq 0 ] && echo KeyA || echo KeyD); curl -s "localhost:7777/keys?k=$k,Space&ms=250&shot=0" >/dev/null
  elif awk "BEGIN{exit !($d>2.6)}"; then curl -s "localhost:7777/key?k=KeyW&ms=250&shot=0" >/dev/null
  else curl -s "localhost:7777/click?shot=0" >/dev/null; fi
done
curl -s --get "localhost:7777/eval" --data-urlencode 'js="arena "+ARENA.active+" hp "+ARENA.hp+" bug "+(ARENA.bug&&ARENA.bug.userData.bug.hp)+" cp "+(getSave()||{}).cp'
