#!/bin/bash
# Converts the CC0 recordings (assets_src/sound) into small mono Ogg Vorbis files in assets/sounds.
set -e
S=assets_src/sound
O=assets/sounds
mkdir -p $O
conv() { # src dst [extra ffmpeg filters]
  ffmpeg -hide_banner -loglevel error -y -i "$1" -ac 1 -ar 44100 -af "${3:-anull},afade=t=out:st=0:d=0" -c:a libvorbis -q:a 4 "$O/$2"
}
trimconv() { # src dst start dur [filters]
  ffmpeg -hide_banner -loglevel error -y -ss "$3" -t "$4" -i "$1" -ac 1 -ar 44100 -af "${5:-anull}" -c:a libvorbis -q:a 4 "$O/$2"
}
K="$S/x_unicae_games_keyboard_soundpack_1_0/Single Keys"
n=1
for k in 001 003 005 007 009 011 013 015 017 019 021 023; do conv "$K/keypress-$k.wav" "key$n.ogg" "highpass=f=120,volume=1.4"; n=$((n+1)); done
conv "$K/keypress-030.wav" space.ogg "lowpass=f=5000,asetrate=44100*0.82,aresample=44100,volume=1.5"
conv "$K/keypress-026.wav" enter.ogg "asetrate=44100*0.9,aresample=44100,volume=1.4"
conv "$S/mouseclick.wav" mouse_down.ogg "volume=0.9"
conv "$S/middle-click-release.wav" mouse_up.ogg "volume=0.7"
conv "$S/x_10_clicks_and_switches/10 Clicks and Switches/click.3.ogg" wheel.ogg "volume=0.35,atempo=1.0"
conv "$S/x_lightswitch_1/light_switch_turn_on.mp3" switch_on.ogg
conv "$S/x_lightswitch_1/light_switch_turn_off.mp3" switch_off.ogg
conv "$S/x_100-CC0-SFX_0/door_open.ogg" door_open.ogg
conv "$S/x_100-CC0-SFX_0/door_close_01.ogg" door_close.ogg
trimconv "$S/creaky_door_hinge.wav" door_creak.ogg 0.2 1.6 "afade=t=out:st=1.2:d=0.4"
conv "$S/x_100-CC0-SFX_0/key_open_01.ogg" door_locked.ogg "volume=0.8"
n=1; for f in 01 02 03 04; do conv "$S/x_sfx_100_v2/sfx100v2_footstep_wood_$f.ogg" "step_wood$n.ogg"; n=$((n+1)); done
conv "$S/x_sfx_100_v2/sfx100v2_footstep_01.ogg" step_tile1.ogg "highpass=f=200"
conv "$S/x_sfx_100_v2/sfx100v2_footstep_02.ogg" step_tile2.ogg "highpass=f=200"
conv "$S/03-footstep.ogg" step_tile3.ogg "highpass=f=200"
conv "$S/04-footstep.ogg" step_tile4.ogg "highpass=f=200"
conv "$S/x_100-CC0-SFX_0/toilet_01.ogg" toilet.ogg
conv "$S/x_sfx_100_v2/sfx100v2_loop_water_01.ogg" water_loop.ogg
conv "$S/x_100-CC0-SFX_0/microwave_door_open.ogg" microwave_open.ogg
conv "$S/x_100-CC0-SFX_0/microwave_door_close.ogg" microwave_close.ogg
conv "$S/amb_fridge_loop_1.wav" fridge_loop.ogg "volume=0.8"
conv "$S/x_100-CC0-wood-metal-SFX/wood_squeak_02.ogg" chair.ogg "volume=0.8"
conv "$S/x_sfx_100_v2/sfx100v2_items_01.ogg" blinds.ogg
conv "$S/x_10_clicks_and_switches/10 Clicks and Switches/click.1.ogg" plug.ogg
conv "$S/x_10_clicks_and_switches/10 Clicks and Switches/click.5.ogg" button.ogg
conv "$S/x_100-CC0-SFX_0/shot_01.ogg" gun.ogg "volume=0.7"
conv "$S/x_100-CC0-SFX_0/tools_01.ogg" reload.ogg
conv "$S/x_sfx_100_v2/sfx100v2_items_02.ogg" pickup.ogg
ls $O | wc -l; du -sh $O
