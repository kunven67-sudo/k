#!/bin/bash
# lookE.sh "<js expr giving a world V3>" : aim at it like with the mouse, show what E would do, press E
r=$(curl -s --get "localhost:7777/eval" --data-urlencode "js=(()=>{ const t=($1); const dx=t.x-PLAYER.pos.x, dz=t.z-PLAYER.pos.z; PLAYER.yaw=Math.atan2(-dx,-dz); const eye=PLAYER.pos.y+(PLAYER.y||0)+PLAYER.eye; PLAYER.pitch=Math.atan2(t.y-eye,Math.hypot(dx,dz)); const it=findInteract(); return Math.hypot(dx,dz).toFixed(1)+' | '+(it?(typeof it.label==='function'?it.label():it.label):'NOTHING'); })()"); echo "$r"; sleep .3; curl -s "localhost:7777/press?k=KeyE&shot=0" >/dev/null
