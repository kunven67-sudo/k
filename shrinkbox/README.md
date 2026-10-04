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
| E | use (light switch, door, power buttons) |
| Esc | pause (save slots, character, settings) |

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
