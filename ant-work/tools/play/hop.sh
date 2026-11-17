#!/bin/bash
# hop.sh from to tx tz : wait on floater[from] until it's near the top and floater[to] near the bottom, then run + jump at the edge toward (tx,tz)
E(){ curl -s --get localhost:7777/eval --data-urlencode "js=$1"; }
for i in $(seq 1 60); do r=$(E "(()=>{const F=LV.floaters.filter(f=>!f.decor),a=F[$1],b=F[$2]; return (a.g.position.y>a.lift[1]-1.2&&b.g.position.y<b.lift[0]+1.5)?'GO':'W'})()"); [ $r = GO ] && break; sleep .2; done
E "(()=>{ const dx=$3-PLAYER.pos.x, dz=$4-PLAYER.pos.z; PLAYER.yaw=Math.atan2(-dx,-dz); return 1 })()" >/dev/null
curl -s "localhost:7777/keys?k=KeyW,ShiftLeft&ms=1300&shot=0" >/dev/null & sleep ${5:-.45}; curl -s "localhost:7777/press?k=Space&shot=0" >/dev/null; wait
E "JSON.stringify({p:[PLAYER.pos.x.toFixed(1),PLAYER.y.toFixed(1),PLAYER.pos.z.toFixed(1)],f:LV.floaters.filter(f=>!f.decor).map(f=>f.g.position.y.toFixed(1))})"; echo
