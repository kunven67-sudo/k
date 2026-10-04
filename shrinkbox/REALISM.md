# 🎯 Shrinkbox Realism Spec

Your graphics-director list, rewritten as commands that actually run in Shrinkbox (one browser file, phones + PC, 60 fps). The part you pasted (skin, eyes, teeth, hands) is folded in as browser-ready commands. It cut off at "Move beyond the face", so I picked up there and added clothes, light, wetness, dust, air, and the Earth.

**How to use:** send me the numbers, like `do #4 #5 #8`. Stick to 3–5 per message so one request doesn't eat your $20 limit.

**Legend:** ⚡ cheap (phones too) · 🔶 medium (High/Ultra quality) · 🔴 heavy (Ultra only, good PC) · 🔬 only shows up when you shrink (Shrinkbox's superpower: every surface has another level of detail underneath)

**Scope:** healthy, living, clothed people, everything around them, and the planet. No wound or injury layers; the cutter stays objects-only.

**Reality check:** no game is truly "indistinguishable from real life", and Shrinkbox is a single file running in a browser. Film-pipeline stuff (100,000 separate hair strands, 8K scanned pore maps, thread-by-thread cloth sim) would lag phones and break the build, so every command below is the version that looks close *and* runs here.

## ⭐ Start here

Biggest realism jump per message, in order (one line = one message):

1. `do #1 #3 #4`
2. `do #8 #9 #11 #13`
3. `do #40 #41 #42 #43`
4. `do #70 #71 #82`
5. `do #5 #6 #95 #97`
6. `do #119 #120 #122`

---

## 0. Foundation (unlocks everything else)

- **#1** 🔶 **Real human body.** Right now people are capsules and spheres (box hands, cone nose), and no skin shader can look real on that. ➜ *Replace the primitive Avatar in avatar.js with one skinned human mesh (eyelids, lips, nostrils, ear folds, 5-finger hands, ~25 bones), built procedurally at load and shared by you, Mom, Dad, and every villager.*
- **#2** ⚡ **Joints that keep their volume.** Basic skinning twists wrists like a candy wrapper and collapses elbows. ➜ *Add forearm/upper-arm twist bones plus elbow, knee, and shoulder corrective shapes so joints keep their volume when bent.*
- **#3** 🔬 **Detail that appears as you shrink.** Real surfaces have detail at every scale. ➜ *Add a detail-layer system: each material gets extra normal/roughness layers that fade in as player.s drops (cm → mm → 0.1 mm), so everything gets more detailed the smaller you get, all the way down to the germ world.*
- **#4** ⚡ **One "surface state" layer for everything.** ➜ *Inject one shader chunk (onBeforeCompile) into every material that adds wetness, dust, grime, fingerprints, and condensation from per-Thing values (t.wet, t.dust, t.dirt), so every environment command below works on every object.*
- **#5** ⚡ **Real brightness range.** Direct sun is about 100,000 lux; a lamp-lit bedroom is about 100–500. ➜ *Switch to AgX tone mapping with physical light units so sunlight through the window is hundreds of times brighter than the lamps, like real life.*
- **#6** ⚡ **Eye adaptation.** Eyes adjust to bright light in seconds but take 20–30 min to fully adjust to the dark. ➜ *Add auto-exposure: fast when it gets brighter (~1 s), slow when it gets darker (~10 s), so the sunny yard blinds you for a moment and a dark room slowly appears.*
- **#7** ⚡ **No lag, ever.** ➜ *Tag every realism feature with a minimum quality (low/medium/high/ultra) in settings.js, and auto-drop the heaviest ones if FPS stays under 50 for 3 s.*

## 1. Skin

- **#8** 🔶 **Subsurface scattering.** Light enters skin and comes out somewhere else. Red travels farthest (millimeters) and blue barely goes in, which gives shadows a soft red edge. ➜ *Implement pre-integrated skin: bake a scattering lookup (N·L × curvature) to a canvas texture at startup, compute mesh curvature, and use both in the skin shader (wide red falloff, tight blue).*
- **#9** ⚡ **Backlit glow.** Thin parts (ears, nostril edges, fingers, eyelids) glow red when light is behind them. ➜ *Add a thickness map to skin (thin at ears, nostrils, finger webbing, eyelids) and a deep-red back-light transmission term.*
- **#10** 🔴 **Screen-space scattering (Ultra).** ➜ *On Ultra, add a separable screen-space scattering blur pass masked to skin pixels only.*
- **#11** ⚡ **Pores by region.** Oil glands are densest on the nose, forehead, and chin (up to ~400–900 per cm²), sparse on the cheeks, and absent on the lips. ➜ *Generate pore normal maps procedurally (Worley noise) weighted by a face-region mask: dense T-zone, medium cheeks, none on lips/eyelids; pores stretch along the skin's tension.*
- **#12** ⚡ **Skin crosshatch.** The back of the hand, forearms, and neck have a fine net of crisscrossing furrows. ➜ *Add a polygon-furrow micro-normal layer on hands, forearms, and neck.*
- **#13** ⚡ **Pigment + blood color.** Real skin color is melanin plus blood showing through. ➜ *Split skin color into melanin (the customizer tone) × a hemoglobin map: redder cheeks, nose tip, ears, lips, knuckles, elbows, knees; faint blue-green over near-surface veins (wrists, temples, under the eyes); palms and soles lighter on every skin tone.*
- **#14** ⚡ **Blood flow reacts.** Fear and cold pull blood away from the skin (pale); heat, running, and embarrassment bring it back (flush). ➜ *Drive a per-person blood multiplier: scared villagers go pale, parents flush after running or near the hot Xbox, cold makes noses and ears pink and lips slightly bluish.*
- **#15** ⚡ **Goosebumps.** Tiny muscles lift each hair when you're cold or scared. ➜ *Blend in a goosebump bump map on arms and legs when it's cold or fear spikes, with the fine hairs standing up.*
- **#16** ⚡ **Oil and sweat.** The T-zone gets shinier through the day; heat and exercise bring out sweat beads. ➜ *Add an oil/sweat specular mask: T-zone shine rises over the real day; forehead and upper-lip sweat beads after running or in a hot room.*
- **#17** ⚡ **Nobody's skin is perfect.** Freckles, moles, birthmarks, small old healed marks, uneven tone. ➜ *Seed 15–40 freckles/moles/marks per person from their seed so everyone looks unique and stays the same between saves.*
- **#18** ⚡ **Peach fuzz.** Almost-invisible hairs cover most skin and glow at the edges in rim light. ➜ *Fake the fuzz with a sheen lobe + fresnel rim on skin; on Ultra add short alpha hair shells on cheeks and forearms.*
- **#19** ⚡ **Age.** ➜ *Add an age value that controls wrinkle depth, skin roughness, and spots: parents get faint crow's feet and forehead lines, kids stay smooth.*
- **#20** ⚡ **Expression wrinkles.** Wrinkles appear only when muscles squeeze the skin. ➜ *Blend wrinkle normal maps by expression: frown → lines between the brows, smile → crow's feet + deeper smile lines; a neutral face stays smooth.*
- **#21** 🔬 **Skin when you're tiny.** The outer layer is stacks of flat dead cells (~30–40 µm wide) that flake off all day. ➜ *When you're tiny on someone's hand or arm, make skin a walkable landscape: a furrow grid, pore craters with hairs growing out, an oily sheen, and flat skin-cell plates lifting at the edges.*

## 2. Body surface & muscles (beyond the face)

- **#22** ⚡ **Neck.** The big neck muscle stands out when the head turns, and an Adam's apple moves when men swallow. ➜ *Add neck detail: muscle ridges that show when the head turns, a throat bump on adult men that moves when they swallow, faint horizontal neck lines.*
- **#23** ⚡ **Collarbones & shoulders.** ➜ *Shape the neckline with collarbone ridges and a sloped trapezius instead of a sphere on a cylinder.*
- **#24** ⚡ **Arms that flex.** ➜ *Add a flex shape: biceps bulge and forearms tighten when someone lifts or carries something.*
- **#25** ⚡ **Tendons & veins.** Wrist tendons pop out when gripping; back-of-hand veins show more when warm and less when cold. ➜ *Add wrist tendon ridges that sharpen on grip, and a hand/forearm vein map whose strength rises with warmth and exercise.*
- **#26** ⚡ **Elbows & knees.** Loose wrinkly skin when straight, smooth when bent, a bit darker and rougher. ➜ *Drive elbow/knee wrinkles by joint angle (wrinkled straight, smooth bent) with slightly darker, rougher skin.*
- **#27** ⚡ **Real hands.** 3 segments per finger, knuckle creases, 3 main palm lines. ➜ *Build hands with 3-segment fingers, knuckle creases on the back, the 3 main palm creases plus finger-joint creases, and lighter palms.*
- **#28** ⚡ **Nails.** A ~0.5 mm see-through plate over a pink bed, a white half-moon at the base, growing ~3.5 mm a month. ➜ *Make nails their own clearcoat material: translucent plate over a pink bed, white half-moon and tip, cuticle line, fine lengthwise ridges.*
- **#29** 🔬 **Fingerprints.** Ridges ~0.5 mm apart; about 60–65% of prints are loops, 30–35% whorls, 5% arches. ➜ *Generate a fingerprint per finger (loop/whorl/arch from the person's seed); when you're tiny it's a ridged landscape with sweat-pore holes along each ridge.*
- **#30** ⚡ **Smudges.** Touching glass leaves skin-oil prints you only notice in reflections. ➜ *When anyone touches a glossy surface (phone, TV, window, mirror, can), stamp an oily print that shows in reflections or on a dark screen; wipes remove it.*
- **#31** ⚡ **Feet.** At night parents go barefoot or in socks; soles have the thickest skin on the body, with calluses. ➜ *Give parents socks or bare feet in the evening: a real arch, 5 toes, toenails, thicker yellowish heel and ball calluses, lighter soles.*
- **#32** ⚡ **Body hair.** ➜ *Add body-hair density maps (forearms, shins, finger backs on adults; none on palms, soles, lips) as hair cards on High+, a subtle tint on Low.*
- **#33** ⚡ **Breathing.** Adults breathe 12–20 times a minute, kids a bit faster. ➜ *Animate chest and shoulders breathing at real rates: faster when running or scared, slow and deep when asleep.*
- **#34** ⚡ **Never frozen.** ➜ *Add idle life: weight shifts every 4–10 s, a tiny balance sway, random fidgets (scratch an arm, rub eyes, check the phone).*
- **#35** ⚡ **Follow-through.** ➜ *Add spring-based secondary motion to hair, hoodie strings, and loose clothes so they lag behind and settle.*
- **#36** ⚡ **Real body sizes.** The average US man is about 175 cm and the average woman about 161 cm; adults are ~7.5 heads tall and their arm span ≈ their height. ➜ *Randomize parents and villagers around real averages and spread, with kids having bigger heads for their body.*
- **#37** ⚡ **Body types.** ➜ *Replace the single build slider with muscle + body-fat sliders that reshape shoulders, waist, and limbs instead of stretching everything.*
- **#38** ⚡ **Every skin tone looks right.** ➜ *Tune the skin shader per tone: deep skin keeps rich warm undertones and a visible sheen (never gray or ashy); light skin shows more red scattering and veins.*

## 3. Face & eyes

- **#39** ⚡ **Eyelids.** ➜ *Give eyes real lids that wrap the eyeball, shadow its top, and follow the gaze (lift when looking up, drop when looking down).*
- **#40** ⚡ **Blinks.** About 15–20 a minute, and a lot fewer while staring at a screen. ➜ *Blink every 3–6 s (fast close, slower open), less while watching TV or a phone, more when it's dusty or they're tired.*
- **#41** ⚡ **Eye jumps.** Eyes jump about 3 times a second when looking around. ➜ *Add saccades, look-at targets (parents glance at movement, villagers look at you when you talk), and both eyes turning in for close objects.*
- **#42** 🔶 **Cornea.** A clear dome (IOR 1.376) that bends your view of the iris and carries the shine. ➜ *Make each eye a sclera ball + a separate clear cornea (IOR 1.376, clearcoat) over a refracted iris, so the iris shifts and the shine slides as the head turns.*
- **#43** ⚡ **Iris & pupil.** The pupil goes from ~2 mm in bright light to ~8 mm in the dark. ➜ *Paint a procedural iris per person (radial fibers, crypts, darker outer ring) and size the pupil 2–8 mm from the light reaching their face.*
- **#44** ⚡ **Whites of the eyes.** Not pure white: faint vessels, pinker corners, a wet line. ➜ *Add faint branching vessels, a pink bump in the inner corner, and a glossy tear line along the lower lid.*
- **#45** ⚡ **Reflections in eyes.** ➜ *Use the room's environment map for eye reflections so the window, lamp, or TV glints in people's eyes.*
- **#46** ⚡ **Brows & lashes.** ➜ *Replace the box eyebrows with hair-card brows (growing up at the inner end, flatter outward) and add curled upper lashes and shorter lower lashes.*
- **#47** 🔬 **Eyelash mites.** Most adults have tiny Demodex mites (~0.3 mm) living in their lash and face follicles. ➜ *In the germ world near a person's eyelashes, add Demodex mites around the lash roots.*
- **#48** ⚡ **Lips.** Thinner skin, so more blood shows through; vertical micro-lines; chapped when the air is dry. ➜ *Give lips their own material: redder scattering, vertical crease normals, soft gloss, a sharp lip border; a bit chapped on dry or cold days.*
- **#49** ⚡ **Nose.** ➜ *Rebuild the nose with real nostril openings (lined up with the body-journey nose entrance), creases at the sides, and a slightly shinier tip.*
- **#50** ⚡ **Ears.** ➜ *Model real ear folds (helix, antihelix, tragus, bowl, lobe) with an opening that lines up with the ear-canal entrance, plus red back-light glow.*
- **#51** 🔶 **Real expressions.** Faces move in separate muscle "action units" (FACS), and a real smile lifts the cheeks too, not just the mouth. ➜ *Drive faces with ~14 FACS-style action units (brow raise/lower, cheek raise, nose wrinkle, lip corner pull/drop, jaw drop, lip press, pucker...) mixed slightly asymmetrically.*
- **#52** ⚡ **Talking mouths.** ➜ *Animate mouth shapes from the speech-synthesis word-boundary events (or timed from the text when a voice doesn't report them) so lips move with their real voices.*
- **#53** ⚡ **Feelings on faces.** ➜ *Map villager fear/trust and parent moods to faces: wide eyes + raised brows when scared, real smiles when they trust you, a frown when Mom's annoyed.*

## 4. Hair

- **#54** 🔶 **Real hair.** A head has about 100,000 hairs, and hair shows two highlights: a white one and a colored one shifted toward the tips. ➜ *Replace the solid hair caps with layered alpha hair cards using anisotropic shading with two shifted highlights.*
- **#55** ⚡ **Backlit hair.** Blond and red hair glow when backlit; black hair barely does. ➜ *Add hair back-light transmission that's strong for light hair and weak for dark hair.*
- **#56** ⚡ **Hairline & part.** ➜ *Add a visible part, a soft fading hairline (no hard edge), and a few flyaway hairs catching the light.*
- **#57** ⚡ **Hair movement.** ➜ *Spring-chain physics for ponytails and long hair: swings with the head, blows in fans and wind.*
- **#58** ⚡ **Wet hair.** ➜ *Wet hair (shower, rain, spilled soda) goes darker, clumps, gets shinier, and dries slowly.*
- **#59** ⚡ **Scalp.** ➜ *For buzz cuts and thin hair, show the scalp with tiny stubble dots.*
- **#60** 🔬 **A hair up close.** A hair is ~50–100 µm thick and covered in overlapping scales like roof shingles. ➜ *In the germ world, make each hair a giant log with shingle-like cuticle scales and frayed split ends.*

## 5. Teeth & mouth (the body-journey entrance)

- **#61** ⚡ **Real teeth.** Adults have 28–32, kids have 20 baby teeth. ➜ *Build real dental arches (incisors, canines, premolars, molars with cusps): 28–32 for adults, 20 baby teeth for kids, matching the body-journey mouth.*
- **#62** ⚡ **Enamel.** See-through bluish edges, warmer near the gums, always wet. ➜ *Enamel shader: translucent bluish tips, warmer toward the gumline, wet clearcoat, slight color differences tooth to tooth.*
- **#63** ⚡ **Gums.** ➜ *Stippled ("orange peel") pink gums with scalloped edges around each tooth.*
- **#64** ⚡ **Tongue.** Covered in tiny velvet bumps plus scattered red dots. ➜ *Cover the tongue with velvety micro-bumps, scattered red mushroom-shaped bumps, a center groove, and a wet sheen.*
- **#65** 🔬 **Tongue when you're tiny.** Taste buds sit in pores on top of the mushroom-shaped bumps. ➜ *When you're tiny, make the velvet bumps walkable spikes and the red bumps big domes with taste-bud pores on top.*
- **#66** ⚡ **Roof of the mouth.** ➜ *Add a ridged hard palate behind the front teeth, a soft palate, and a uvula that sways when they breathe or talk.*
- **#67** ⚡ **Saliva.** People make roughly 0.5–1.5 liters a day. ➜ *Add a saliva layer: glossy everything, a pool under the tongue, and swallow waves that pull tiny-you toward the throat.*
- **#68** ⚡ **Dark mouth.** ➜ *Light the inside of the mouth realistically: dark unless it opens toward a light, so your watch flashlight (L) matters.*
- **#69** ⚡ **Breathing you can time.** ➜ *Sync the body-journey breath pull to the visible breathing cycle so you can time your escape between breaths.*

## 6. Clothes & fabric

- **#70** ⚡ **Real fabric structure.** T-shirts are knit (tiny V-shaped loops), not woven. Jeans are 3×1 twill with blue threads one way and white the other, which is why the inside is lighter. Hoodies are fleece. Sheets are woven at 200–800 threads per square inch. ➜ *Generate fabric maps by type: jersey knit for tees, 3×1 indigo/white twill for jeans (lighter inside), brushed fleece for hoodies, rib knit for socks and cuffs, plain/sateen weave for sheets.*
- **#71** ⚡ **Fabric shine.** Cotton glows softly at the edges, satin and nylon have stretched highlights, leather is glossy. ➜ *Use physical sheen for cotton/fleece, anisotropic highlights for satin and nylon jackets, clearcoat for leather shoes.*
- **#72** ⚡ **How clothes are made.** About 8–12 stitches per inch. ➜ *Add stitch lines, folded hems, orange topstitching and copper rivets on jeans, zipper teeth, drawstring tips, and a care tag in the collar.*
- **#73** ⚡ **Wrinkles from poses.** ➜ *Blend wrinkle maps by joint angle: folds inside bent elbows and knees, tension folds when reaching, stacked folds at the jeans' hem.*
- **#74** 🔶 **Real cloth physics.** ➜ *Add a lightweight cloth solver (≈20×20 points, collides with physics shapes) for curtains, the bed blanket, towels, and flags; tiny-you can climb a blanket and make it sag.*
- **#75** 🔴 **Simulated clothes (Ultra).** ➜ *On Ultra, simulate hoodie hems and long shirts with a coarse cloth proxy that follows the body.*
- **#76** ⚡ **Wear & tear.** ➜ *Give each piece of clothing a wear value: faded knees, seat, and elbows, denim fade lines at the hips and behind the knees, fleece pilling under the arms, stretched tee collars, the odd sock hole.*
- **#77** ⚡ **Dirt & stains.** ➜ *Build up dirt on hems, cuffs, knees, and soles; food-drip stains after eating; grass stains after being outside; add a laundry chore that cleans it all.*
- **#78** ⚡ **Shoes.** ➜ *Rebuild shoes: a rounded toe box with flex creases, tread with dirt stuck in it, real laces, scuffed toes.*
- **#79** 🔬 **Clothes when you're tiny.** Yarn is ~0.2–0.3 mm thick; cotton fibers are flat twisted ribbons ~15 µm wide; polyester fibers are smooth round rods. ➜ *When you shrink onto clothes or bedding, make knit-loop/twill terrain at mm scale, then twisted yarn bundles of ribbon-like cotton fibers or smooth polyester rods in the germ world.*
- **#80** ⚡ **Lint & pet hair.** ➜ *Collect lint and your pets' hair on dark clothes and the couch over time; sell a lint roller in the shop.*
- **#81** ⚡ **Clothes on a schedule.** ➜ *Dress parents by the real clock and weather: work clothes on weekdays, pajamas at night, jackets outside when it's cold.*

## 7. Light

- **#82** ⚡ **Sunbeams.** You only see floating dust where the beam is. ➜ *Add volumetric sunbeams through windows (from the real sun direction) with dust specks that sparkle only inside the beam.*
- **#83** 🔶 **Soft contact shadows.** ➜ *Add GTAO on High+ so corners, under the bed, and inside the Xbox get soft darkening; baked vertex AO on Low.*
- **#84** 🔶 **Bounced light.** Sun on a red rug tints the ceiling slightly red. ➜ *Bake a light-probe grid per room (refreshed when the sun moves or a light switches) so light bounces and picks up color.*
- **#85** ⚡ **Real light colors.** Sunset ~2000 K, midday sun ~5500 K, warm bulbs 2700 K, screens ~6500 K, candles ~1900 K. ➜ *Set every light's color from its real color temperature, with the sun's changing by its height in the sky.*
- **#86** ⚡ **Screen glow.** ➜ *Make TVs, phones, and monitors cast their average screen color onto nearby faces and walls, flickering with what's on.*
- **#87** ⚡ **Everything reflects a little.** Every surface gets shinier at grazing angles. ➜ *Audit all materials for realistic specular + fresnel (no flat "clay" look): floor finish, eggshell wall paint, plastics, skin.*
- **#88** 🔶 **Real reflections.** At night, with the lights on inside, windows turn into mirrors. ➜ *Add planar reflections for the bathroom mirror and the black TV; at night windows faintly reflect the room.*
- **#89** ⚡ **Bending light.** Water's IOR is 1.333, ice 1.31, glass ~1.5; a glass of water flips what's behind it. ➜ *Use transmission + real IOR + slight dispersion so a glass of water magnifies and flips what's behind it.*
- **#90** ⚡ **Caustics.** ➜ *Project animated caustics under water glasses, the fish tank, and the pool when the sun hits them.*
- **#91** 🔶 **Real shadow softness.** Shadows are sharp near the object and blurry far away, and the sun is 0.53° wide. ➜ *Use contact-hardening (PCSS) shadows on High+, sized by each light's real size.*
- **#92** ⚡ **Phone-camera flicker.** US power is 60 Hz, so cheap LEDs flicker 120 times a second: invisible to your eyes, but phone cameras show rolling bands. ➜ *In the phone Camera app, show faint rolling bands when pointed at cheap LED bulbs or the TV.*
- **#93** 🔬 **Light when you're tiny.** Thin stuff lets light through, and disc grooves split light into rainbows (CD grooves are 1.6 µm apart, DVD 0.74 µm, Blu-ray 0.32 µm, so Blu-ray only shows a rainbow at low grazing angles). ➜ *Make paper, leaves, plastic film, and ear skin glow with light passing through when you're tiny, and give discs a rainbow diffraction sheen from their real groove spacing.*

## 8. Wetness

- **#94** ⚡ **Wet surfaces.** Porous stuff (cotton, carpet, wood, concrete, paper) gets darker and glossier when wet; plastic, metal, and glass bead up instead. ➜ *In the surface-state layer, darken and gloss porous materials when wet; bead droplets on non-porous ones.*
- **#95** ⚡ **Spills.** Soda spreads, soaks into carpet, and dries into a sticky sugar film. ➜ *Make knocked-over drinks spread into real puddles, soak into carpet as stains, and dry (~30 min) into sticky patches that slow you down (really sticky when you're tiny).*
- **#96** ⚡ **Coffee rings.** Drying drops push their particles to the edge, leaving a darker ring. ➜ *When spills dry, leave a darker ring at the edge.*
- **#97** ⚡ **Sweating cans.** A fridge-cold can (~4 °C) in a 21 °C room at 50% humidity (dew point ≈10 °C) fogs up in seconds; the drops grow, merge, and run down. ➜ *Make cold drinks sweat: droplets form when a fridge-cold can sits in the warm room, grow, merge, run down, and leave a water ring; when you're tiny each drop is a wobbly dome you can bounce on.*
- **#98** ⚡ **Drop shapes.** Water drops smaller than ~2.7 mm stay round; bigger ones flatten into puddles. ➜ *Shape drops by water's real capillary length (2.7 mm): small = round beads, big = flat puddles.*
- **#99** 🔬 **Water climbs.** ➜ *Add capillary wicking: water creeps into paper towels and fabric and up narrow gaps, pulling tiny-you along.*
- **#100** ⚡ **Wet footprints.** ➜ *After someone steps in a spill or leaves the shower, leave fading wet footprints on hard floors for a minute or two.*
- **#101** ⚡ **Shower steam.** ➜ *When a parent showers, fill the bathroom with steam, fog the mirror (clearing from the edges over ~10 min), and let you write in the fog.*
- **#102** ⚡ **Rain.** California gets most of its rain from November to March. ➜ *Add rain on a realistic season: drops crawling down windows, dark shiny pavement, puddles with ripples.*
- **#103** ⚡ **Dew & sprinklers.** ➜ *Morning dew on grass and car windshields, and early-morning sprinklers that keep the lawn wet until midday.*

## 9. Dust & grime

- **#104** ⚡ **Dust builds up.** ➜ *Collect dust over real time on upward-facing surfaces (a fuzzy gray layer), cleared where people touch or wipe, leaving streaks.*
- **#105** ⚡ **Dust bunnies.** ➜ *Spawn dust bunnies under the bed and behind the TV that roll when the air moves; tiny-you sees giant tumbleweeds of fibers and hair.*
- **#106** ⚡ **Screen dust.** Screens attract dust with static. ➜ *Give TV and monitor screens a faint dust layer that shows when they're off.*
- **#107** ⚡ **Kicked-up dust.** ➜ *Puff dust up from carpets when someone walks; when you're tiny it's a dust storm that pushes you.*
- **#108** ⚡ **Tracked-in dirt.** A lot of house dust is outdoor soil carried in on shoes. ➜ *Make floors dirtier near the front door and along walking paths, cleaned on a real vacuuming day.*
- **#109** 🔬 **What dust really is.** Skin flakes, fibers, pet dander, pollen, soil grains, bug bits, and dust mites (0.2–0.3 mm). ➜ *Make germ-world dust a realistic mix: skin flakes, cotton and polyester fibers, your pets' hair, pollen (spikier in spring), soil grains, and dust mites.*
- **#110** ⚡ **Touch spots.** ➜ *Darken and polish touch points over time from skin oil: light switches, door handles, controller grips, phone edges, the WASD keys.*
- **#111** ⚡ **Cobwebs.** ➜ *Add cobwebs in ceiling corners and under furniture that collect dust and sway in drafts; tiny-you sticks to them.*
- **#112** ⚡ **Bathroom grime.** ➜ *Darken bathroom grout and caulk with a bit of mildew over time; cleaning fixes it.*

## 10. Air, breath & heat

- **#113** ⚡ **Breath fog.** Breath is warm and wet, so it fogs cold glass; outside it shows up below about 7 °C (45 °F). ➜ *Fog a patch on cold glass when someone breathes on it (fading in 2–5 s), and show visible breath outside when it's cold.*
- **#114** ⚡ **Breath on tiny you.** ➜ *When you're tiny near a face, each breath pushes you away or pulls you in, in rhythm.*
- **#115** ⚡ **Heat shimmer.** Hot air bends light. ➜ *Add heat-haze distortion above the Xbox exhaust, toaster, stove, and sunny summer pavement.*
- **#116** ⚡ **Drafts.** Heating and AC usually cycle a few times an hour. ➜ *Add vents that cycle like a real thermostat; when they're on, curtains sway, dust drifts, and tiny-you can ride the air.*
- **#117** ⚡ **Fans.** ➜ *Add a ceiling fan whose airflow pushes dust, paper, and tiny-you outward.*
- **#118** ⚡ **Room temperature & humidity.** ➜ *Track indoor temperature and humidity (warm afternoons, cool nights, heater/AC) and feed it into condensation, sweat, goosebumps, and breath fog.*

## 11. The Earth (outside)

- **#119** ⚡ **Real sky.** Blue from Rayleigh scattering, haze from Mie scattering, red sunsets from light's long path through the air. ➜ *Replace the sky with a physical Rayleigh+Mie sky driven by the real sun position (blue day, orange/pink sunset, blue hour).*
- **#120** ⚡ **Real moon.** A full moon lights the ground at about 0.1–0.3 lux. ➜ *Compute the real moon position and phase from today's date and light the yard with it.*
- **#121** ⚡ **Real stars.** ➜ *Add the ~300 brightest real stars at west-coast latitude, turning around Polaris; suburban light pollution hides the faint ones.*
- **#122** ⚡ **West-coast weather.** Morning marine-layer fog (May Gray / June Gloom), dry Santa Ana winds in fall, rainy winters, golden dry hills by late summer. ➜ *Add a west-coast weather sim with those seasons, tied to the real date.*
- **#123** ⚡ **Clouds.** ➜ *Add layered-noise clouds that drift with the wind and cast moving shadows on the yard.*
- **#124** ⚡ **Real yard plants.** ➜ *Plant a realistic west-coast yard: lawn, a lemon tree, agapanthus, rosemary, a palm or coast live oak, all swaying in the wind.*
- **#125** 🔶 **Grass blades.** ➜ *Grow instanced grass blades with wind near the camera (a cheap texture far away); when you're tiny each blade is a climbable wall with dew drops.*
- **#126** ⚡ **Fall leaves.** ➜ *Scatter fallen leaves in autumn that blow in the wind and crunch when stepped on.*
- **#127** 🔬 **Soil world.** Soil is full of springtails, nematodes, fungus threads, and tardigrades living in moss (~0.3–0.5 mm). ➜ *Add an outdoor germ world for dirt and lawn: sand/silt/clay grains, root hairs, fungus threads, jumping springtails, nematodes, and tardigrades in moss.*
- **#128** ⚡ **Bugs outside.** ➜ *Add an ant trail that forms toward dropped food (a pheromone path), garden spiders in webs, and bees on flowers during the day.*
- **#129** ⚡ **Sidewalks & roads.** ➜ *Sidewalks with control joints every ~5 ft, stones showing in the concrete, weeds in the cracks, asphalt with oil stains; tiny-you sees boulders.*
- **#130** ⚡ **Seeing far when giant.** Horizon distance ≈ 3.57 × √(eye height in m) km: ~4.7 km at normal size, ~30 km at 70 m tall. ➜ *When you grow giant, extend the view with distance haze, the correct horizon for your eye height, and low-detail neighborhood blocks.*
- **#131** ⚡ **Neighborhood life.** ➜ *Add neighborhood life on the real clock: rush-hour traffic 7–9 am and 4–6 pm, a weekly garbage-truck day, dog walkers, kids walking home around 3 pm.*
