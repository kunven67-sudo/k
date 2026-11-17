#!/bin/bash
E(){ curl -s --get localhost:7777/eval --data-urlencode "js=$1"; }
curl -s "localhost:7777/open?game=aw4&cp=town&speed=4&preset=toaster&shot=0" >/dev/null; ./go.sh 15 >/dev/null
E "(giveItem('revolver'),INV.slots.find(s=>s&&s.id==='revolver').loaded=6,giveAmmo('bullets',18),giveKey('caboose'),selectSlot(INV.slots.findIndex(s=>s&&s.id==='revolver')),1)" >/dev/null
./walkto.sh -60 5 2 >/dev/null; ./walkto.sh -150 8 2 >/dev/null; ./walkto.sh -195 14 2 >/dev/null; ./walkto.sh -195 14 1 >/dev/null
for i in $(seq 1 200); do r=$(E "TRAIN.g.position.z.toFixed(0)+' '+TRAIN.stopT.toFixed(1)"); set -- $r; awk "BEGIN{exit !($1>-60&&$1<40)}" && break; sleep .5; done
E "(SLOWMO.target=SLOWMO.k=.22,1)" >/dev/null; echo "train near: $r"
for i in $(seq 1 300); do r=$(E "(()=>{ SLOWMO.target=SLOWMO.k=.22; if(LOOP.dying) return 'DEAD'; const it=curItem(), cp=camera.getWorldPosition(V3()); const live=TRAIN.guards.filter(h=>!h.userData.dead); if(!live.length) return 'CLEAR hp '+INV.hp.toFixed(0); const vis=live.filter(h=>canSee(h,cp,90)); const t=(vis[0]||live[0]); const p=headOf(t).clone().add(V3(0,-.2,0)); const d=p.sub(camera.position); PLAYER.yaw=Math.atan2(-d.x,-d.z); PLAYER.pitch=Math.atan2(d.y,Math.hypot(d.x,d.z)); return (it&&it.loaded>0?(vis.length?'FIRE':'WAIT'):'LOAD')+' '+live.length+' hp '+INV.hp.toFixed(0)+' d '+Math.hypot(d.x,d.z).toFixed(0)+' tz '+TRAIN.g.position.z.toFixed(0); })()")
  case "$r" in DEAD*|CLEAR*) echo "$r"; break;; FIRE*) curl -s "localhost:7777/click?shot=0" >/dev/null;; LOAD*) curl -s "localhost:7777/key?k=KeyR&ms=1500&shot=0" >/dev/null;; *) sleep .2;; esac; [ $((i%8)) = 0 ] && echo "$r"; done
E "(SLOWMO.target=1,1)" >/dev/null
