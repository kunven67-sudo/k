#!/bin/bash
# ride.sh i  : wait until floater i (0..2) is near target height $2 and the next one ($3 index) near $4, then sprint-jump toward it
E(){ curl -s --get localhost:7777/eval --data-urlencode "js=$1"; }
E "JSON.stringify({p:[PLAYER.pos.x.toFixed(1),PLAYER.y.toFixed(1),PLAYER.pos.z.toFixed(1)],f:LV.floaters.filter(f=>!f.decor).map(f=>f.g.position.y.toFixed(1)),jump:LV.env.jump})"
