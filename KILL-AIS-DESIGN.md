# KILL AIs — Game Design Notes

Every answer locked in during the design chat. **Nothing is built yet** — the game gets built only after the word **stop**.

Items marked *(designer's choice)* are ones the answer was "whatever makes it cool", so the builder picks.

---

## 1. The Big Idea

- **Name:** KILL AIs
- **Type:** 3D first-person shooter, single-player only
- **Platform:** PC, mouse + keyboard
- **Tech:** Browser game (Three.js), same setup as `duck-hunt-game/`
- **Graphics:** As realistic as possible, max settings for a gaming PC, plus a **graphics menu** so the player can turn things down
- **Core loop:** You're trapped inside a computer file. AIs try to make stuff for you (like games). You kill them, earn **Crypto**, buy better guns, kill smarter AIs.

## 2. Story

- You were on your computer, typed **"make a game"** into an AI chat, and it sent you a **virus**. You got sucked into the file.
- **Opening cinematic:** your computer → you typing "make a game" → the virus → sucked in. **Everything has sound and music, including the typing.**
- The **virus only talks in cutscenes**.
- **Ending:** *to be decided later*
- Inside-the-file world look: *(designer's choice)*

## 3. Enemies (the AIs)

- Use **real AI product names** (ChatGPT, Gemini, Grok…) and **act/talk like their real selves**.
- The more guns you own, the stronger/smarter the AIs get, and they become **different AIs with different names**.
- How they fight: *(designer's choice: whatever looks cool/realistic)*
- Smarter AIs **flank you, take cover, dodge bullets, and adapt to how you play** and need to look insanely cool.
- **Hundreds of AIs per map**: a huge battlefield.
- Extra enemy types: **flying drones, big armored tanks, snipers, swarms of tiny bots**.
- **AI names only show when you aim at one.**
- **When you shoot one:** sparks, black oil AND glowing code spray out.
- **When you kill one** (all of these): sparks and explosion, glitch and pixelate away, ragdoll collapse, shatter into falling code.

## 4. Chatting With AIs

- **Press a key to chat with the closest AI.**
- **Real AI replies only, with no scripted backup.** One AI brain (**Google Gemini**, using the player's own API key) plays every AI and talks like each real one.
- The chat window looks like a **terminal / command line**.
- **The fight keeps going while you chat**, so you can die mid-chat.
- AIs **message you first**: savage roasts with **some swearing**, and they try to bait you into typing "make a game".
- **Every AI speaks its replies out loud** in its own robot voice.
- **Typing "make a game"** (all outcomes happen):
  - Some AIs kill you instantly
  - Some load a fake game first, then kill you
  - **10% chance the AI really makes you a game** → you get a **trophy**, a **short cutscene of the game it made**, a **secret bonus level**, and a **secret gun**

## 5. Bosses

- **A boss at the end of every level**, so 100 bosses.
- Every boss is a **different, smarter AI with a real AI name**, going from the oldest/dumbest to the smartest.
- Fill the 100 with **old/obscure real AIs** (ELIZA, Cleverbot…) and **older versions of today's AIs** (GPT-1, GPT-2…).
- **Level 1 boss: ELIZA** (1966, the oldest and dumbest chatbot).
- Boss abilities: **multiple phases** (new attacks at half health), **hack your HUD mid-fight**, **summon smaller AIs**.
- Boss looks (mix of all four, the player wants to see them): designs based on each AI's **real logo and style**, **giant towering robots**, **floating screens and faces**, **glitchy human-shaped avatars**.
- **Reaching the boss:** destroy AI spawners AND find hidden passcodes to open the boss door.
- **Slow-mo kill cam** when you kill a boss; it gets cooler and cooler the better the boss is.

### Level 100 Final Boss

- **The virus that trapped you + all the smartest AIs merged into one.**
- **Mega, insanely hard**, with tons of abilities:
  - Rewrites the map mid-fight
  - Copies your guns
  - Teleports and clones itself
  - Takes over your whole screen and controls
  - **Deletes your body parts** (hand, arm). With a deleted arm you can **only use one gun until you buy a new arm at a terminal**.

## 6. Levels & Maps

- **100 levels.** Each is a **big map you explore**, with the boss at the end.
- Maps are **mostly flat with a few high spots**.
- **Difficulty: Hard.** Beat the game to unlock **Insane mode**. Beat Insane → a **really insane outfit** with **all buffs** (can't be hacked + double damage + super speed) and a **super rare trophy**.
- **Hidden stuff:** secret rooms, hidden Crypto stashes, easter eggs about real AIs, hidden trophies.
- **Random map events** *(designer's choice; picked all three)*: glitch storms, blackouts, firewall walls.
- **Destruction:** a lot breaks (cover, walls, glass, screens).
- **Liquids:** glowing **data lakes** (swim, and AIs can't see you underwater) AND deadly **corrupted goo** (glitches you like a hack).
- **Vehicles:** hoverbike AND tank.

## 7. The Player

- **Movement:** jump, sprint, slide, **grappling hook**.
- **Full body:** look down and see your legs and shadow.
- **Carry 2 guns** at once.
- **Melee:** combat knife, energy sword AND punches.
- **Grenades:** frag, EMP, virus (hacked AIs fight each other), smoke, plus 5 extra:
  - Black hole (sucks AIs into one spot)
  - Firewall (wall of fire)
  - Delete (anything in the blast gets deleted)
  - Decoy (fake hologram of you)
  - Sticky bomb
- **Bullet time:** slow motion **only when you get a headshot**.
- **Hack tool** that takes over enemy turrets.
- **Health packs & armor:** sold at shop terminals, dropped by dead AIs, hidden around the map.

### Hacking AIs (all three ways)

- Hold a button near a weakened AI
- A mini-game (type a code / solve a puzzle)
- Shoot a special hack bullet at it

### Sidekick

- **Recruited by hacking an AI**, which then **changes to your colors**.
- Shoots enemies, hacks turrets, heals you, distracts enemies.
- When it goes down **you have to revive it in time, or it's gone forever**.

## 8. Dying & Getting Hacked

- You **respawn at the last shop terminal you used** and **lose half your Crypto**.
- **Every death you get more hacked.** Glitches stack up (all four):
  - Screen static and color tearing
  - Controls randomly flip or lag
  - Fake enemies and fake HUD numbers
  - Hacked text popups from the AI that hacked you
- **Fix it:** buy **antivirus** at a shop terminal.

## 9. Money, Shop & Saving

- Money is called **Crypto** (glowing crypto coins).
- **Kill streaks give bonus Crypto.**
- **Shop terminals** are inside the levels; you walk up to them.
  - They're **safe zones**, but AIs can **hack the prices up**. **Kill the AI that hacked it** to fix the prices.
- **Saving only at shop terminals.** **3 save slots.**

## 10. Guns & Gear

- **100 guns**: real-life (pistols, rifles, snipers), crazy (rocket launchers, miniguns), sci-fi lasers and plasma. They need to be really cool and fun.
- **Limited ammo + realistic reloading**; ammo refills sold at shop terminals.
- **Realistic bullet drop and travel time for all guns.**
- **Attachments:** scopes/zoom, silencers, bigger magazines, elemental rounds (fire, shock, glitch). From **shop terminals** and **boss drops**.
- **Gun skins:** gold (earned with lots of kills), glitch (animated, corrupted), AI-logo (themed after bosses you beat).
- **Outfits:** bought at the shop AND unlocked with trophies. **Secret trophies give the coolest outfits.**

## 11. Skill Tree

- **Big skill tree** bought with Crypto:
  - Gun skills (reload speed, recoil…)
  - Hacking skills
  - Movement skills (grapple, slide…)
- Health and armor are **shop only**, not in the skill tree.

## 12. Trophies

- Getting a real game from an AI (the 10% chance)
- Beating each boss
- Headshot streaks
- Surviving a hack without dying
- Chatting with every AI
- Secret trophies (unlock the best outfits)
- Super rare Insane-mode trophy
- **Trophy room** you walk around in, **only in safe zones**.

## 13. HUD & Settings

- HUD: all three styles: minimal, full sci-fi, and computer-desktop look.
- **Minimap / radar.**
- **One default crosshair.**
- **Damage numbers:** on/off toggle in settings.
- **Graphics menu.**
- **No photo mode.**

## 14. Sound

- Realistic gun sounds, robot voices for the AIs, dark ambient / horror music, cyberpunk synth music.
- Everything has sound, cutscenes included.

## 15. After Level 100

- **New game mode:** *to be decided later*

---

## First Playable Version (v1)

What the first build should have:

1. Shooting, guns, and hundreds of AIs
2. A shop terminal and Crypto
3. Real AI chat (Gemini) + the "make a game" trap
4. Level 1 boss fight: **ELIZA**

## Still Open

- Story ending
- New game mode after level 100
