# POCKET SIZE

*Everything is bigger than you now.*

A third-person 3D adventure built with Three.js. You doom-scroll five shorts in bed, fall
asleep, and wake up **1.8 centimetres tall**. Your house is life-size, which makes it a
mountain range. Your dog is a sleeping giant. Your phone is on the desk, completely out of reach.

Everything is generated from code when the game starts: the models, textures, fur, grass,
animation, sound effects, music and voice. There are no art or audio files to download.

## Playing

The game uses JavaScript modules, so it has to be served over `http://` rather than opened by
double-clicking the file. Any of these work:

- **GitHub Pages**: turn on Pages for this repo and open `/pocket-size/`.
- **Local server**: from the repo root run `npx http-server` (or `python3 -m http.server`),
  then open `http://localhost:8080/pocket-size/`.
- **Single file**: `play.html` has the whole game bundled into one file, so you can
  double-click it. Rebuild it with `node build.mjs` after changing the code.

Click **Start**. Chrome, Edge or Firefox on a PC or laptop with a mouse and keyboard works best.

## Story (spoiler-light)

1. **Doomscroll**: it's late. Five shorts, five seconds each, then the phone goes on the desk.
2. **Big Morning**: you wake up tiny. Leap onto the fallen pillow, squeeze under the door,
   sneak past Biscuit, haul your paper airplane home, mash **E** to climb the blanket, then
   fly the airplane to the desk.
3. **Inside the Phone**: a pixelated world full of viruses. The Call app has no signal, and
   the "restore size" wires are fakes that blow up the phone.
4. **The Great Outdoors**: the sun burns at this size. Hide in the bush, where the ants,
   mosquitoes, beetles, mites, fleas, ticks and spiders live. Somewhere deep inside is
   something much bigger.
5. **Small World Survival**: gather pebbles and fibre, craft an axe, cut grass, craft a
   pickaxe and weapons, build a workbench, a campfire and a shelter, and find what shrank you.
6. **Germ Size**: smaller than a germ, the world turns into something like outer space. Your
   weapons are too big to hold now, so you craft new ones from diatom glass and cellulose,
   fight bacteria, phages, a tardigrade and a giant amoeba, and collect the three Macro Shards.

## Controls

| Action | Key |
| --- | --- |
| Move / look | `WASD` / mouse |
| Jump / sprint / sneak | `Space` / `Shift` / `C` |
| Interact, climb (mash) | `E` |
| Drop carried item | `G` |
| Attack | Left mouse |
| Backpack & crafting | `Tab` or `I` |
| Hotbar | `1`–`8` |
| Eat / use / wear | `F` |
| Build mode (outside) | `B` (`R` rotates) |
| First / third person | `V` |
| Skip cutscene | hold `Space` |
| Pause | `Esc` |

## Adding the phone videos

Every short on the phone is a black screen for now. To add real videos:

1. Put the files in `pocket-size/videos/`.
2. In `js/videos.js`, set `src: 'videos/your-file.mp4'` on an entry.

You can list more than five. Each playthrough picks five different ones at random.

## Extras

- **37 achievements**, some of them secret.
- **Ways to Die**: 15 ways to die, tracked in their own menu.
- **Settings**: graphics presets up to Ultra, macro depth of field, bloom, film grain, FOV,
  sensitivity, invert Y, difficulty, volumes, text-to-speech voice, subtitles, and a
  "5D Immersion" mode (spatial audio, rumble, heavier camera shake).
- **Chapters**: replay any chapter you've reached.
- **Saves**: progress saves automatically at checkpoints. Use **Continue** to pick up again.
