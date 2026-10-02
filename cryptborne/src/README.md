# Cryptborne source layout

`../build.sh` concatenates `00_head.html`, `01_body.html` and every `[1-9]*.js` file (in name order) into one `index.html`. All scripts share one global scope; there are no modules.

| File | What it holds |
| --- | --- |
| `00_head.html` | `<title>`, fonts, all CSS |
| `01_body.html` | canvas, HUD, screens (menu, saves, creator, settings), modals |
| `10_core.js` | helpers (`$`, `clamp`, `rand`, `mulberry32`, `LS`...), `SET` settings |
| `11_audio.js` | `Sfx` (synth effects), `Music` (mood-based procedural music), `Amb` (ambience loops, positional sounds), footsteps, monster voices |
| `20_art.js` | pixel sprite helpers, item icon templates, creature templates, `drawHuman` (poses, blink, breathing), tree and prop baking |
| `30_items.js` | `ITEMS`, gems, rarity colours, sell prices, gear helpers (upgrade level, sockets) |
| `31_monsters.js` | `MON` (every monster, mini-boss and boss) |
| `32_places.js` | `DUNGEONS`, `REGIONS`, shops, region vendors |
| `33_classes.js` | `CLASSES`, `SPECIALS`, `SKILLS`, `PETS`, difficulty table |
| `34_story.js` | `NOTES`, cutscene scripts, ending texts, quest templates |
| `40_store.js` | `Store` (browser saves + Claude account sync) |
| `50_tiles.js` | tile ids, solidity, tile painting, map layer baking |
| `51_overworld.js` | the Vale, the four regions, your house interior, gates between maps |
| `52_dungeon.js` | dungeon generator: rooms, mini-boss, key door, healing spring + lever, boss gate, secret room, notes, captives |
| `60_state.js` | `G` run state, new saves and v1 to v2 migration (`normalizeSave`), inventory, gear, stats from class/skills/gems |
| `61_time.js` | clock, day/night, night counter, weather |
| `62_monsters.js` | spawning, AI, bosses, death animations |
| `63_combat.js` | player attacks, damage, specials, projectiles, pickups, chests |
| `64_pets.js` | pet follow/attack/abilities |
| `65_quests.js` | quest offers, progress, turn-in |
| `66_story.js` | cutscene runner, notes, story flags, endings |
| `67_areas.js` | entering maps/dungeons, transitions, interactions, sleeping, villagers' routines |
| `68_player.js` | player movement, dodge, block, footsteps, hazards, the per-frame world update |
| `70_render.js` | world rendering, animated water/trees/grass, lighting, weather particles, labels |
| `71_hud.js` | minimap, world map canvas, specials bar |
| `80_ui.js` | HUD text, toasts, bag, shops, upgrades, pet shop |
| `81_ui_menus.js` | menu, saves, hero creator, settings, pause, death, skill tree, journal, notes, cutscene text and choices, credits |
| `90_main.js` | input (keyboard, mouse, touch), saving, starting/quitting a game, main loop, boot |

## Save data (version 2)

```
{ v: 2, id, name, created, lastLoaded, lastSaved,
  cls, look: { skin, hair, hairStyle, shirt, pants }, diff,
  player: { level, xp, coins, hp, map, x, y, sp, skills: { nodeId: rank },
            specials: [id, id, id, id], inv: [slot|null x INV_SIZE],
            eq: { weapon: gear|null, shield: gear|null, armor: gear|null },
            pets: { owned: [id], active: id|null, xp: { id: n } } },
  world: { time, day, nights },
  story: { act, flags: {}, notes: { noteId: true }, seen: { cutsceneId: true }, seals: {}, ending, endings: {}, visited: { mapId: true } },
  quests: { active: [quest], done: n, offers: { giverId: quest }, freed: {} },
  stats: { kills, chests, deaths, bosses: {}, playTime, byType: {} } }
slot = { id, n } for stackables, { id, n: 1, up, gems: [] } for gear
gear = { id, up, gems }
```
