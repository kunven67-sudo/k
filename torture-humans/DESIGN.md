# Torture Humans — design notes (from the Q&A with the player)

Tech: Three.js, 1st/3rd person (switch with a key). Ships as ONE .html for the
game system (https://gamesystem2.netlify.app/); fallback = Windows .exe with an
Update button. Size doesn't matter, go all out. Realistic humans (Rocketbox, MIT).
Graphics settings menu so it never lags. Zero bugs.

## World (round 1)
- Small town: main street, shops, police station, fire station, clinic, park, houses
- You are a mad scientist
- ~30 unique humans with emotions, personalities, jobs, daily routines
- Day/night cycle + weather
- Start in the basement lab, climb a metal ladder (real animation, not a cutscene) into your bedroom, go outside

## Shrink ray + catching (round 2)
- Hold to charge (glow + hum), release = beam, shrink animation
- Then you hold a real jar (animated) and have to click at the right moment to catch the tiny human
- You can also step on tiny humans

## Lab (round 2)
- Gadget wall, bug farm, computer with town cameras, workbench upgrades, "and more"

## Gadgets (round 2)
- Shrink ray, grow ray, freeze gun, tractor beam, tranquilizer, net gun, emotion ray, tame ray

## Cages (round 2)
- One big main terrarium in the middle of the lab (dirt, grass, rocks, pond, sticks)
- Plus extra themed cages (jungle, desert, water)
- Press F on a cage to shrink yourself inside; humans can kill you, you can hurt them

## Bugs (round 3)
- 25+: scary hunters (tarantula, scorpion, mantis, centipede, wasp, black widow),
  normal (ant colony, beetle, cockroach, grasshopper, cricket, fly, mosquito),
  cute/tameable (ladybug, butterfly, caterpillar, bee, snail, rolly-polly, firefly),
  water/weird (water spider, dragonfly, leech, stick bug, rideable rhino beetle)
- Humans can fight, tame, eat bugs

## Tiny humans in the cage (round 3)
- You feed the humans and pet bugs
- You give tiny resources (wood, etc.) and they build different buildings depending on what they have
- They can die from hunger and thirst
- Survive on their own, team up or fight (personality), try to escape, talk (speech bubbles + voice sounds)
- Taming: feeding + tame ray

## Witnesses (round 3)
- Setting to pick: wanted level + police / just panic / nobody cares

## Shrinking yourself into the cage (round 4)
- You can say ANYTHING to tiny humans: a chat box to type, or talk with the microphone
- They build buildings; you can destroy them
- Resources are realistic: trees need an axe, stone needs a pickaxe (no tool = can't).
  Tools make gathering faster. They gather themselves, or you give them resources.
- Lava, water, real-looking terrain (no flat surfaces). Good visuals everywhere.
- Collisions must follow real shapes (no invisible square boxes)
- Tiny you: fight with weapons, ride tamed bugs, talk to humans, build + gather
- Dying in the cage = wake up in the lab (no game over)

## You (round 4)
- Health bar, hunger + thirst, sleep / energy

## Controls (round 4)
- Keyboard + mouse AND controller (Xbox/PlayStation); rebind any key in settings

## Human brains + talking (round 5)
- AI brain runs on the player's GPU (WebGPU, offline after a one-time ~2 GB download)
- They remember your chats; they can fall in love with you (you're a boy); some are gay; they can help you
- You can erase specific memories, or wipe a whole brain
- Mic: offline Whisper speech-to-text (hold a key to talk) + chat box
- Everyone in town is an adult (no kids in the game)

## Gore (round 5)
- Setting: none / some blood / full gore (full = you can see insides)

## Money (round 5, all in settings)
- Tiny humans only have money if you give it to them; they turn it into tiny coins
- A tiny bank; they buy houses from each other if one is for sale

## Saving (round 5)
- Auto-save every few minutes + when you sleep, plus 3 manual save slots

## Music (round 6)
- Creepy lab music, chill town day music (crickets at night), intense chase/fight music, epic tiny-world music

## Main menu (round 6)
- Live 3D lab: camera drifts around the lab, a tiny human bangs on the glass. Play / Load / Settings / Quit

## Graphics settings (round 6)
- Presets Low / Medium / High / Ultra / Insane
- Every detail: shadows, textures, grass, draw distance, reflections, AA, resolution scale, FPS limit
- FPS counter; fancy lighting (SSAO, bloom, soft shadows, sun rays)
- "More stuff to do in the lab" (to ask about)

## Town life (round 6)
- Shops you can buy from (food, gadget parts, bug food), your own job/money, drivable cars

## More lab (round 7)
- Chemistry set (potions: speed, strength, invisibility, ...)
- Bug breeding + mutating (mix two bugs, radiation)
- Surgery table (swap parts, robot arms, chips; respects the gore setting)
- Invention bench (craft new gadgets/weapons from parts)
- Clone machine (clone humans or yourself), robot helper
- Secret lab door (police search your house when you're wanted)
- Human zoo shelves (jars/display cases)

## Your job / money (round 7)
- Sell inventions (shop or lab computer), normal town jobs (mini-games), sell bugs to the pet store, secret missions on the computer

## Cars (round 7)
- Start with an old car in your garage, buy better ones; humans drive too, traffic, crashes

## Town humans (round 8)
- Real daily schedules by job, relationships (friends/families/couples; missing-person search + posters),
  they remember and react to you (fear, like, gossip), random events (fires, crashes, robberies, parties, storms)

## Weather (round 8)
- Rain + thunderstorms (puddles, wet streets), snow (piles up, coats), fog, four seasons

## Build + delivery (round 8)
- Player wants it ALL AT ONCE (one big release, not staged public versions)
- First target: Windows .exe with one-click Update (like CursorVerse); single .html for gamesystem2 later
