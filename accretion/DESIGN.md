# Accretion — design spec

Everything below was chosen by the player in the question rounds. When a choice
was marked "most realistic", the game follows real astrophysics as closely as a
playable game allows. This file is the checklist for the build.

## Core loop
- You start as a ~6 km clump of rock in the dusty disk of a young Sun-like star.
- You move with **volcanic jets** (Newton's third law). Every burst costs a little mass.
- Space has no friction; gravity from everything pulls on you.
- **Eating**: get close and your gravity tears smaller bodies apart at the **Roche limit**; the debris spirals in. Slow impacts stick, fast ones blast material off you.
- **Damage**: mass is your health. Anything bigger can tear you apart or swallow you.
- **Death**: you shatter and are reborn as a chunk of yourself somewhere else; the galaxy remembers what you ate.
- **Path by diet**: what you eat decides what you become.
  - Rock/metal/ice/carbon → rocky worlds: dwarf planet → planet → super-Earth → mega-Earth, or ocean world, iron planet, carbon/diamond world. Without hydrogen you never ignite as a star.
  - Gas → ice giant → gas giant → brown dwarf → star.
  - Stars: red dwarf → Sun-like → blue-white → massive.
  - Sun-like and smaller stars age into a **red giant**, then a **white dwarf**. A white dwarf over 1.4 solar masses explodes as a **Type Ia supernova** with no remnant.
  - Massive stars burn heavier elements, explode, and leave a **neutron star** or **black hole**.
  - Neutron stars over ~2.3 solar masses collapse into black holes.
- **Forecast panel**: shows what your current diet will turn you into.

## Scale and time
- A real-scale spiral galaxy with **hundreds of billions of stars**, generated on the fly from the galaxy's shape. Interstellar distances are real (light-years). Inside star systems, distances are 10× shorter than real so there is always something nearby.
- **Living galaxy**: stars age, swell, explode and form; other worlds grow life over deep time.
- Time warp for travel; **deep-time warp** (millions to billions of years per second) only in a safe, calm orbit or in empty space.
- **Andromeda** collides with the galaxy about 4.5 billion years in.
- **Endgame**: deep-time to the end of the universe: star formation stops, stars burn out, black holes evaporate by Hawking radiation.
- HUD time: your age in years, current time speed, real playtime.

## Your planet
- Composition (rock, iron, ice, carbon, gas) sets your look, density and type.
- **Magnetic field + auroras**; without one, star wind strips your air (like Mars).
- **Plate tectonics**: continents drift over deep time.
- **Volcanoes** build your atmosphere; big eruptions cause ice ages.
- **Greenhouse and snowball** climates.
- **Spin**: impacts change day length and tilt; **tidal locking**; **seasons**; **eclipses** from your moons.
- **Eating feel**: glowing craters that cool, shockwave rings for giant impacts.
- **Moons**: giant-impact moons from debris rings; tides and tidal heating; life can spread to moons; you can name them.
- **Rings** from shredded moons slowly rain down onto you.
- **Earth Similarity Index** shows how Earth-like you are.

## Life
- Appears by itself when conditions fit (water, air, temperature, field), on geological time.
- Stages: microbes → oxygen → plants → animals → intelligence → cities → space age.
- Real-style events on a timeline: Great Oxygenation, first forests, mass extinctions.
- Mass extinctions from impacts, heat, cold; survivors recover.
- Life changes the planet: oxygen air, green continents, city lights.
- Civilization (you only watch): satellites and stations, moon and planet colonies, interstellar probes that reveal systems on your map, Dyson swarm; deflects incoming asteroids (like NASA's DART).
- Life dies if you become a gas giant or a star; it is remembered in your history.
- Other living worlds are rare; find them with the telescope.

## Stages beyond planets
- **Gas giant**: migration through the disk (can become a hot Jupiter), carves a gap in the disk, giant storms, icy moons with hidden oceans and life.
- **Star**: your own solar system from captured bodies, binary stars with gas streams, flares and coronal mass ejections.
- **Neutron star**: spin up to a millisecond pulsar by eating, magnetar flares, pulsar beams that heat what they cross, kilonova (gold) from merging with another neutron star.
- **Black hole**: spaghettified stars, mergers with gravitational waves, quasar jets when feeding fast, spin from what you eat (lopsided shadow, better efficiency, stronger jets, frame dragging), eat other galaxies.
- **Nebulae**: passing through triggers star birth.

## Dangers
Star heat, supernovae, asteroid and comet storms, wandering black holes, gamma-ray bursts, star flybys (comet showers), rogue planets, magnetar flares.

## Views and tools
- 3D chase camera, free orbit camera, view from your surface (sky, moons, meteors).
- **Low-orbit view** (~200 km): clouds, hurricanes, night lightning, volcano plumes, meteors, auroras, city lights.
- **Cutaway**: live layers sized from your composition, convection, depth probe for temperature and pressure.
- **Planet info screen** and **life timeline**.
- **Vision modes**: visible, infrared, X-ray, radio.
- **3D galaxy map** you can spin and zoom.
- **Telescope**: transit light curves, atmosphere spectra (oxygen + methane = life), zoom image, mark targets.
- **Encyclopedia** of everything discovered, short simple facts.

## Modes and meta
- Realistic survival (one difficulty: real physics), sandbox (spawn anything, set mass and makeup, time controls, invincible), challenges with achievements (science, survival, life, collection), photo mode.
- Save slots with autosave and a copyable backup code.
- Tutorial at the start plus tips the first time new things happen.
- Comfort: reduce flashing, bigger text, colorblind-safe colors, camera shake toggle.
- HUD cycles between full, minimal and off.
- Names: catalog-style names (like "Kepler-442 b"). The game is called **Accretion**.
- Sound: felt rumbles only, plus civilization radio near a civilized world and sounds recreated from real space data (pulsar beats, plasma whistlers).
- Graphics default: high (gaming PC), with auto-detect fallback.
