#!/bin/bash
E(){ curl -s --get localhost:7777/eval --data-urlencode "js=$1"; }
fy(){ E "LV.floaters.filter(f=>!f.decor)[$1].g.position.y.toFixed(1)"; }
./walkto.sh 226 44 1 >/dev/null
for i in $(seq 1 80); do awk "BEGIN{exit !($(E "PLAYER.y.toFixed(1)")>.5)}" && break; sleep .2; done
./hop.sh 0 1 235 40; ./hop.sh 1 2 245 44 .55
for i in $(seq 1 60); do awk "BEGIN{exit !($(fy 2)>35.6)}" && break; sleep .2; done
E "(PLAYER.yaw=Math.atan2(-(258-PLAYER.pos.x),-(44-PLAYER.pos.z)),1)" >/dev/null; curl -s "localhost:7777/key?k=KeyW&ms=2600&shot=0" >/dev/null
./go.sh 20 | grep -o '"y":[0-9.]*\|"obj":"[^"]*"'
