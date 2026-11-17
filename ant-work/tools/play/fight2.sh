#!/bin/bash
# fight like a person: windup close -> sidestep/jump out; bug recovering -> rush in + stab; idle -> close in + stab when in reach
end=$((SECONDS+${1:-240})); n=0; side=KeyA
while [ $SECONDS -lt $end ]; do
  s=$(curl -s --get "localhost:7777/eval" --data-urlencode 'js=(()=>{ SLOWMO.target=SLOWMO.k=.2; if(!ARENA.active) return "END "+ARENA.hp; const st=ARENA.st,B=ARENA.bug.userData.bug, c=bugCenter(); const dx=c.x-PLAYER.pos.x, dz=c.z-PLAYER.pos.z; PLAYER.yaw=Math.atan2(-dx,-dz); PLAYER.pitch=-.12; const e=Math.hypot(dx,dz)-B.r; const mk=st.mark&&st.phase==="wind"?Math.hypot(PLAYER.pos.x-st.tgt.x,PLAYER.pos.z-st.tgt.z):99; return [e.toFixed(2),st.phase,(st.atk&&st.atk.n)||"-",mk.toFixed(1),ARENA.hp,st.hp|0,(WEAPONS[ARENA.cur]||{reach:2}).reach,(st.phase==="wind"?st.t/st.atk.w:0).toFixed(2),ARENA.dodgeCd>0?1:0].join(" "); })()')
  set -- $s; [ "$1" = "END" ] && { echo "FIGHT OVER, my hp $2"; break; }
  e=$1; ph=$2; at=$3; mk=$4; reach=$7; wk=$8; dcd=$9; n=$((n+1)); [ $((n%15)) -eq 0 ] && echo "edge $e $ph $at myHP $5 bugHP $6"
  if [ "$ph" = wind ] && awk "BEGIN{exit !($wk>.62 && $dcd==0 && ($e<5.2 || $mk<4))}"; then curl -s "localhost:7777/keys?k=$side,Space&ms=200&shot=0" >/dev/null; side=$([ $side = KeyA ] && echo KeyD || echo KeyA)
  elif [ "$ph" = wind ]; then sleep .03
  elif awk "BEGIN{exit !($e>$reach-.3)}"; then curl -s "localhost:7777/keys?k=KeyW,ShiftLeft&ms=220&shot=0" >/dev/null
  else curl -s "localhost:7777/click?shot=0" >/dev/null; fi
done
curl -s --get "localhost:7777/eval" --data-urlencode 'js="arena "+ARENA.active+" hp "+ARENA.hp+" cp "+(getSave()||{}).cp'
