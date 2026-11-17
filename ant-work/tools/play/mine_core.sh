#!/bin/bash
E(){ curl -s --get localhost:7777/eval --data-urlencode "js=$1"; }
./mine_to_bob.sh; ./walkto.sh -15 -48 .8 >/dev/null; ./walkto.sh 0 -48 .8 >/dev/null; ./walkto.sh 0 -62 .8 >/dev/null
curl -s "localhost:7777/press?k=Digit2&shot=0" >/dev/null; sleep .3; E "(PLAYER.yaw=0,PLAYER.pitch=-.05,1)" >/dev/null; curl -s "localhost:7777/click?shot=0" >/dev/null; curl -s "localhost:7777/key?k=KeyS&ms=2500&shot=0" >/dev/null; sleep 4
echo "blown $(E '!!F.rocksBlown') hp $(E 'INV.hp')"; ./walkto.sh 0 -98 .8 >/dev/null; ./walkto.sh 0 -102 .6 >/dev/null; ./lookE.sh "LEVELS.mine.core.getWorldPosition(V3())"; sleep 2
echo "core $(E '!!F.coreTaken')"
for i in $(seq 1 60); do r=$(E "(()=>{ const z=PLAYER.pos.z, x=PLAYER.pos.x; const tx=(z<-50&&z>-62)||(z<-6&&z>-18)?1.5:0; PLAYER.yaw=Math.atan2(-(tx-x),-(200)); return LV.name+' '+z.toFixed(1)+' '+MTHING.chase.toFixed(1)+' '+!!LOOP.dying+' st '+PLAYER.stamina.toFixed(2) })()"); set -- $r; [ "$1" != mine ] && { echo "OUT: $r"; break; }; [ "$4" = true ] && { echo "DIED: $r"; break; }; [ $((i%4)) = 0 ] && echo "$r"
  if awk "BEGIN{exit !($6>.1)}"; then curl -s "localhost:7777/keys?k=KeyW,ShiftLeft&ms=600&shot=0" >/dev/null; else curl -s "localhost:7777/key?k=KeyW&ms=600&shot=0" >/dev/null; fi; done
