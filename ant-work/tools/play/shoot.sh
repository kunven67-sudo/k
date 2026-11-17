#!/bin/bash
# aim at the nearest live rider's chest/head and fire; hold R to load when empty (like a player)
E(){ curl -s --get localhost:7777/eval --data-urlencode "js=$1"; }
end=$((SECONDS+${1:-120}))
while [ $SECONDS -lt $end ]; do
  r=$(E "(()=>{ if(LOOP.dying) return 'DEAD'; const live=(NIGHT4.riders||[]).filter(h=>!h.userData.dead&&h.visible); const it=curItem(); if(!live.length) return 'CLEAR '+INV.hp; const t=live.sort((a,b)=>a.position.distanceTo(PLAYER.pos)-b.position.distanceTo(PLAYER.pos))[0]; const p=headOf(t).clone().add(V3(0,-.25,0)); const d=p.sub(camera.position); PLAYER.yaw=Math.atan2(-d.x,-d.z); PLAYER.pitch=Math.atan2(d.y,Math.hypot(d.x,d.z)); return (it&&it.loaded>0?'FIRE':'LOAD')+' '+live.length+' hp '+INV.hp+' d '+Math.hypot(d.x,d.z).toFixed(0)+' ammo '+(it?it.loaded:'-') })()")
  case "$r" in DEAD*|CLEAR*) echo "$r"; break;; FIRE*) curl -s "localhost:7777/click?shot=0" >/dev/null;; LOAD*) curl -s "localhost:7777/key?k=KeyR&ms=1200&shot=0" >/dev/null;; *) sleep .3;; esac
  n=$((n+1)); [ $((n%8)) = 0 ] && echo "$r"; done
