#!/bin/bash
curl -s "localhost:7777/open?game=aw3&cp=twistedKey&speed=2&preset=toaster&shot=0" >/dev/null; ./go.sh 30 >/dev/null; ./walkto.sh 280 26 1.2 >/dev/null; curl -s --get localhost:7777/eval --data-urlencode "js=(PLAYER.yaw=0,1)" >/dev/null; curl -s "localhost:7777/key?k=KeyW&ms=2500&shot=0" | grep -o '"y":[0-9.]*'; ./walkto.sh 214 0 1 >/dev/null; sleep 3; ./go.sh 20 >/dev/null
