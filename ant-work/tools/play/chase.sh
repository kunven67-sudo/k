#!/bin/bash
# I run east for the tablecloth; when his hand's shadow is near me, I cut sideways
end=$((SECONDS+${1:-150}))
while [ $SECONDS -lt $end ]; do
  s=$(curl -s --get "localhost:7777/eval" --data-urlencode 'js=(()=>{ SLOWMO.target=SLOWMO.k=.45; if(DLG.active) return "DLG"; if(CHOICE.active) return "CHOICE"; if(!PLAYER.ctl.move) return "LOCK "+PLAYER.pos.x.toFixed(1)+" "+(LV.floorMode?"floor":"table"); const a=CHASE.busy&&CHASE.slamAt; const tx=LV.floorMode?FLOOR.doorX:50, tz=LV.floorMode?(FLOOR.crack0+FLOOR.crack1)/2:0; PLAYER.yaw=Math.atan2(-(tx-PLAYER.pos.x),-(tz-PLAYER.pos.z)); let side="none"; if(a&&Math.hypot(a.x-PLAYER.pos.x,a.z-PLAYER.pos.z)<5) side=(a.z>PLAYER.pos.z)?"KeyD":"KeyA"; return "RUN "+PLAYER.pos.x.toFixed(1)+" "+PLAYER.pos.z.toFixed(1)+" "+side+" "+(LV.floorMode?"floor":"table"); })()')
  case "$s" in DLG*) curl -s "localhost:7777/press?k=Enter&shot=0" >/dev/null;; CHOICE*) echo "CHOICE $(curl -s localhost:7777/state | grep -o '"choices":\[[^]]*\]')"; curl -s "localhost:7777/press?k=Digit1&shot=0" >/dev/null;;
    LOCK*) echo "$s"; sleep 1;;
    RUN*) set -- $s; n=$((n+1)); [ $((n%4)) -eq 0 ] && echo "$s"; if [ "$4" != "none" ]; then curl -s "localhost:7777/keys?k=KeyW,ShiftLeft,$4&ms=1300&shot=0" >/dev/null; else curl -s "localhost:7777/keys?k=KeyW,ShiftLeft&ms=900&shot=0" >/dev/null; fi;;
    *) echo "?? $s"; sleep 1;; esac
  st=$(curl -s "localhost:7777/state"); echo "$st" | grep -q '"lv":"twisted"' && { echo "MADE IT -> twisted"; break; }
done
curl -s "localhost:7777/state" | grep -o '"lv":"[^"]*"\|"cp":"[^"]*"\|"card":"[^"]*"'
