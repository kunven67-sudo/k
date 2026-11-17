#!/bin/bash
curl -s "localhost:7777/open?game=aw4&cp=mineDebug&speed=4&preset=toaster&shot=0" >/dev/null; ./go.sh 20 >/dev/null; curl -s --get localhost:7777/eval --data-urlencode "js=(F.wireDone=1,learn('ship'),1)" >/dev/null
./walkto.sh 1.4 -9 .5 >/dev/null; ./walkto.sh 1.4 -15 .5 >/dev/null; ./walkto.sh 0 -47.5 .8 >/dev/null; ./walkto.sh -15 -48 .8 >/dev/null; ./walkto.sh -17.5 -51.5 .6 >/dev/null
