#!/bin/bash
# stay in cover; only shoot riders I can actually see; load when nobody's in sight
E(){ curl -s --get localhost:7777/eval --data-urlencode "js=$1"; }
end=$((SECONDS+${1:-120})); n=0
while [ $SECONDS -lt $end ]; do
  r=$(E "(()=>{ if(LOOP.dying) return 'DEAD'; const it=curItem(), cp=camera.getWorldPosition(V3()); const all=(NIGHT4.riders||[]).filter(h=>!h.userData.dead&&h.visible); if(!all.length) return 'CLEAR hp '+INV.hp.toFixed(0); const live=all.filter(h=>canSee(h,cp,90)); if(!live.length) return (it&&it.loaded<6?'LOAD':'WAIT')+' '+all.length+' hp '+INV.hp.toFixed(0); const t=live.sort((a,b)=>a.position.distanceTo(PLAYER.pos)-b.position.distanceTo(PLAYER.pos))[0]; const p=headOf(t).clone().add(V3(0,-.25,0)); const d=p.sub(camera.position); PLAYER.yaw=Math.atan2(-d.x,-d.z); PLAYER.pitch=Math.atan2(d.y,Math.hypot(d.x,d.z)); return (it&&it.loaded>0?'FIRE':'LOAD')+' '+all.length+' hp '+INV.hp.toFixed(0)+' d '+Math.hypot(d.x,d.z).toFixed(0)+' ammo '+(it?it.loaded:'-'); })()")
  case "$r" in DEAD*|CLEAR*) echo "$r"; break;; FIRE*) curl -s "localhost:7777/click?shot=0" >/dev/null;; LOAD*) curl -s "localhost:7777/key?k=KeyR&ms=2500&shot=0" >/dev/null;; *) sleep .3;; esac
  n=$((n+1)); [ $((n%10)) = 0 ] && echo "$r"; done
