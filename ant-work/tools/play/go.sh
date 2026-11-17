#!/bin/bash
# go.sh <max seconds>: keep reading the screen, Enter through talking, stop when I can move or have to choose
end=$((SECONDS+${1:-60})); while [ $SECONDS -lt $end ]; do s=$(curl -s "localhost:7777/wait?ms=1000&shot=0"); echo "$s" | grep -q '"dlg":true' && curl -s "localhost:7777/press?k=Enter&shot=0" >/dev/null; echo "$s" | grep -q '"choice":true\|"move":true' && break; done; curl -s "localhost:7777/wait?ms=100" | cut -c1-600
