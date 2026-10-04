# SHRINKBOX 📦🔬

A realistic shrinking sandbox. You found a mystery watch in the basement:
**hold F to shrink, hold G to grow.** Your bedroom becomes a giant world, and
everything in it is real inside. Fall through the Xbox's top vent into the fan,
squeeze into the controller through the USB-C port, swim in a can of soda.

## Play

Double-click **`play.html`** (the whole game is in that one file).
Chrome / Edge / Firefox. Works with mouse + keyboard, an Xbox controller, or touch.

| Key | Does |
| --- | --- |
| WASD / mouse | move / look |
| Space · Shift · Ctrl | jump · run · crouch |
| **Hold F / Hold G** | **shrink / grow** |
| V | first / third person |
| L | watch light (for dark places like inside the Xbox) |
| E | use (light switch, door, power buttons) / pick up |
| Q | spawn menu (food, electronics, furniture, toys) |
| 1-6 | tools: hands, shrinker, glue gun, duct tape, cutter, clean |
| T / Enter | talk to someone (type, or use the 🎤 mic) |
| P / Tab | your phone: messages, bank, shop, sell, chores, camera |
| Click | use tool (shrinker: hold to charge, scroll = shrink/grow) |
| R / Z | spin held thing / undo last glue or tape |
| Esc | pause (save slots, character, settings) |

## Places

- **Your room** + the **whole house**: hallway, stairs, bathroom, your parents'
  room, office, living room, dining room, kitchen, den, garage, basement.
- **Inside things**: Xbox, controller, phone, soda can, TV, toilet tank, fridge,
  pot on the stove, microwave, the car's engine bay, pet habitats.
- **The germ world** (below 0.45 mm): the surface you stand on, under a microscope.
- **The atom world** (hold F at 1.5 µm... the notes say don't): air molecules,
  water films, crystal lattices, polymer chains. Down to one atom tall.
- **Inside a person**: mouth, throat, stomach, intestines... and out. Or the
  nose (sneeze!), the wrong pipe (cough!), or the ear canal.
- **The wall village**: tiny people living behind the baseboard.
- **Outside**: grow until you smash through the roof.

## What's realistic

- Collisions are the real shapes. Vents have real holes, the soda can is hollow,
  the controller has a real USB-C port. Nothing is an invisible box.
- Tiny-you is a normal person, just smaller: falls feel long (like jumping off a
  skyscraper) and don't hurt. Falls only hurt at normal size.
- Inside the Xbox: 130 mm fan (it blows tiny-you away when on), a heat sink
  with 55 fins (gets ~70°C), the APU + RAM chips, a disc drive with a spinning
  disc and a laser, and the power supply (capacitors zap you).
- Soda: surface tension makes it a trampoline when you're tiny (hold crouch to
  push through), it's thick like honey, bubbles push you up, you come out sticky.
- Real sun position and real clock (west coast), real date (Halloween in October).

## Build from source

```
npm install
npm run build      # writes play.html
npm run dev        # rebuilds on every save
```

Code: `js/core` (engine, physics, input, audio, textures), `js/world` (room +
objects; `thing.js` is the real-shape object builder), `js/player`, `js/ui`.
Design notes from the Q&A: `DESIGN.md`.
