# 🌀 Rift Lab

A realistic sandbox in your browser. Everything (land, trees, sky, sounds) is made in code.

## Play
Open `index.html` through a web server (or the playable link). Needs a WebGL2 browser (Chrome / Edge / Firefox) with hardware acceleration on. A gaming PC is recommended. Lower **Settings → Graphics** if it's slow.

## Controls
| Action | Key |
|---|---|
| Move | W A S D |
| Look | Mouse (click the game first) |
| Sprint (you get tired) | Shift |
| Jog on/off | Caps Lock |
| Jump / climb over logs, rocks, fences | Space |
| Crouch | Ctrl or C |
| Lean | Q / E |
| Look at your watch | hold T |
| Fast-forward time (x10 / x100 / x1000) | F |
| Pause / save | Esc |

## What's in this build (piece 1)
- Main menu with a live 3D world behind it, new-world options, save slots, settings
- Empty World (Meadow + oak/maple forest): real-geology land from a seed, mountains you can see past, a lake + a river carved from a mountain spring
- Real sun, moon phase and bright stars for the real date + your time zone, clouds, sunsets, dark nights
- Procedural oak, maple + birch trees with fall colors from the real date, wind, grass, rocks, fallen logs, stumps
- You: real walking/jogging/sprinting speeds, stamina, crouch, lean, jump, climb/vault, swim + hold your breath, fall damage + injuries, footsteps per surface
- Collisions built from the same shapes you see (tested: trees, rocks and logs stop you within a few cm of the surface)
- Sound made in code: wind, leaves, river, birds by day, crickets + owls at night, footsteps, breathing, ambient music

See `MASTER_LIST.md` for the whole plan and `CHAT_HANDOFF.md` for every decision.
