# GAMBLE — Design Bible

*A Loaded Dice Studios game.* Virtual money only — no real money can be won or lost.

This file records every design decision agreed with the game's owner during the
question rounds. It is the source of truth when building. **Golden rule: when a
choice is about realism, pick the MOST realistic option.** Any new option shown
to the owner must be tagged 🟢 least realistic / 🟡 realistic / 🔴 most realistic.

---

## 1. Platform & presentation

- 3D browser game (Three.js), hosted on **GitHub Pages** (website link friends can open).
- Target: **gaming PC**, Chrome/Edge, high graphics (auto-detect + Settings override).
- Controls: **keyboard + mouse**.
- Camera: **third-person, over-the-shoulder** (GTA 5 / Uncharted style).
- Art: **chunky cartoon 3D**, **chunky human** proportions (big heads/hands, thick
  arms, round bellies), **semi-real eyes** (Fortnite-like), **MAX jiggle physics**
  (characters, hair, bellies, cars, furniture, food on plates).
- Tone: **real-life mix** — funny and sad moments depending on what happens.
- Boot sequence: **content warning screen** ("Contains violence, blood, alcohol,
  strong language and gambling with VIRTUAL money only…") → studio splash
  (Loaded Dice Studios) → logo → main menu.
- Logo: each launch randomly picks one of: neon cursive (one letter half-broken),
  chunky gold 3D with coins spilling, playing-card letters flipping in, slot reels
  landing on G-A-M-B-L-E.
- Main menu: **a giant slot machine**. Clickable buttons on the machine choose
  Play / Multiplayer / Settings / Credits / Quit; the lever spins randomly just for
  fun (sometimes a tiny fake "jackpot" animation). Music: **smooth lounge jazz**
  with soft slot sounds.
- Loading screens: random mix of (a) town-newspaper headlines from YOUR game,
  (b) funny useless tips, (c) a tiny free slot machine to spin.
- **No HUD.** Needs are shown through the body (stomach growl, sweat, shiver,
  yawn, stink lines). Cash is counted in the wallet. Time on the phone or a
  wristwatch. Map is the phone GPS. **No interaction hints/outlines** — press E on
  things. Achievements are **silent** (checked in the stats book / phone).
- **No pause** in single player — Esc opens the menu but the world keeps going.
- Photo mode **without freezing the world**, instant replay (last ~10 s), slow-mo
  on big moments (roulette ball landing, last card, car flips).
- Interiors are **seamless** — no loading screens; doors swing open, you can see
  through windows.

## 2. Save & death

- **One life.** Constant autosave, no reloading, **no backups**. Clearing the
  browser = life gone.
- Death deletes the save → **newspaper obituary** with the whole life story
  (days survived, biggest win/loss, cause of death e.g. "shot in the left hand,
  bled out") → fresh start.
- Multiplayer death rule is a **host lobby setting** (permadeath or hospital).

## 3. Character

- Full creator: body, skin, hair, face, eyes, clothes, name, **age 21+**, voice
  (used to speak whatever you type). Any gender.
- Style life: clothing stores, barber, tattoos, jewelry. Hair/beard grows over
  days, you smell without showers. Looks change how NPCs and dates treat you.
- Natural walking style; mood, injuries, drunkenness and weight change it.
- Body changes: weight & muscle from diet/exercise, depending on each person's
  **metabolism**. Strength affects fights and carrying.
- **Real aging**: birthdays every 365 days, ID checked at casino doors (lose your
  wallet → no entry), can die of old age after decades.
- Movement: sprint (stamina), jump (squash & stretch), climb/vault, crouch/sneak,
  grab & throw almost anything (including people), FLOP button (ragdoll).
- Emote wheel, automatic facial expressions, mood system (happy, stressed,
  depressed, lucky, tilted) affecting walk/talk/NPC reactions.
- **No backstory.** Opening = **hungover mystery**: wake on the motel floor with
  $100 crumpled in your hand and no memory. The cracked phone has a blurry video
  of a crime you witnessed. **Nobody is after you** — you decide what to do with it.
- Inventory: **real pockets & hands** — small things in pockets, big things carried
  in your hands (slower), heavy stuff needs a car. Pickpockets can take pocket items.

## 4. Needs & health

- Needs: hunger, thirst, energy, hygiene, bladder, fun/boredom, body temperature.
- At zero **you can die**. Bladder → public accident. Temperature → shivering/sick
  or sweating/thirst.
- Exhaustion: staying up makes you dizzy, worse at mini-games, you can fall asleep
  at the table and get robbed.
- Sleep: time-lapse of the room through the night, alarm clock, **bed quality**
  (cheap mattress → back pain), oversleeping → groggy, **nightmares** from stress/debt.
- **Real injuries** by hit location (head, hands, arms, legs, torso): stab and gunshot
  wounds, bleeding, blood trails/pools, broken arm (cast, slower at cards), broken
  leg (crutches, can't drive), concussion (blur). **Headshots can kill instantly.**
  Blood as realistic as possible, with a Settings toggle.
- **Real sickness**: colds, flu, food poisoning; spreads to partner/kids/friends;
  gets worse if ignored.
- **Real US medical prices** (ambulance ~$1,200, ER ~$3,000, broken arm ~$7,500),
  health insurance ~$400/month; unpaid bills → debt.
- Drunk (fully realistic): buy drinks (casino comp drinks are free, like real life),
  tipsy → wasted levels, blurry/double vision, delayed controls, slurred bubbles,
  falling, hangovers; drunk driving → pulled over, DUI fine, license, impound;
  blackouts → wake up somewhere random missing money. **Tolerance builds up.**
- **Real addiction**: tilt after losses (shaking hands, red pulse, urge to chase),
  cravings when away, partner/family notice; support-group meetings help recover.

## 5. Time, calendar, weather, world

- **1 game day = 48 real minutes** (1 game hour = 2 real minutes).
- **Real calendar** (365 days, real holiday dates), seasons of real length; a new
  life starts on **today's real date**.
- **Live real weather** from a free API (Open-Meteo) for Reno and each other city.
  Rain puddles, thunderstorms (power outages), fog, wind blowing trash, snow & icy
  roads, desert heat.
- **Real-dark nights**: headlights/streetlights needed, starry desert sky.
- Home city: **Reno, Nevada**, **real street layout** shrunk to fit (Virginia St,
  the Reno Arch, Truckee River, Midtown, airport…). **Big city**, **every building
  enterable**.
- Other real cities: **Las Vegas** (desert strip, chapels, heat), **New Orleans /
  bayou** (riverboat casinos, jazz bars, gator tours), **Macau** (passport from the
  post office, international flight, pataca currency with exchange fees, jet lag,
  baccarat VIP rooms), **Lake Tahoe** (snowy ski-resort casinos).
- Travel: highway driving (~15+ real minutes, gas, rest stops, highway patrol,
  breakdowns, sleepy night driving), airplanes (tickets, airport security — no guns,
  lost luggage, in-flight drinks), bus/train (cheap, slow, pickpockets), private jet,
  **fly your own plane** (pilot license). Also motorcycles, bicycles & skateboards,
  boats/jet skis (Tahoe, bayou).
- **Real brand names everywhere** (names only — no copied logos/artwork).
- **Nevada has no lottery** → drive to the California border for lottery tickets and
  scratch cards; nightly draw on TV.
- Real Reno events: Great Reno Balloon Race (Sept), Hot August Nights (Aug),
  Super Bowl Sunday at the sportsbook, holidays (4th of July fireworks, Halloween
  costumes, Thanksgiving buffets, Christmas lights, New Year's Eve).
- Random events: nightly lottery draw, whales & celebrities, chaos (power outages
  mid-spin, robberies, raids on the back-alley den, car chases), happy hours
  (double payouts, free buffet day, cheap beer night, poker tournaments).
- Easter eggs: desert UFO at 3:33 AM, haunted motel room 13, hidden silver-mining
  money vault found through clues.

## 6. Home life

- Start in a **cheap motel room**, **$45 every night** at the front desk. Can't pay →
  sleep in your car or on a park bench (robbery risk). Motel life: cockroaches,
  bed bugs, neighbors yelling through thin walls, weird guy in room 9.
- Ladder: motel → trailer → apartment → house → penthouse → mansion. Rent/
  mortgage, electric/water/heating bills, eviction, burglars (locks, alarm).
- Furniture arrives in boxes; **carry it in yourself** (physics, can tip/break);
  build mode once inside. Styles: cozy cabin, gamer setup, luxury, cheap & used.
- Smart home (real brands): Ring doorbell, Alexa, ADT alarm, Roomba (cat rides it).
- Roommates (NPCs or online friends) split rent; each has a personality.
- TV: local news (reports your crimes), sports, 3 AM infomercials (order by phone),
  shows (soap, cooking show that teaches recipes, cartoons, game show), streaming
  apps (Netflix etc.) with **made-up movies/shows** (fake posters, short clips).
- Pirate movie apps on TV/phone: can get deleted, give viruses, steal data; buy a
  security app for protection.
- Electronics & cords (HDMI, chargers…) wear out and break; bugs/mice chew cords.
- Cooking: groceries are cheapest, cooking mini-game, burnt food, smoke alarm,
  **kitchen fires** (extinguisher/fire dept), spoilage, food poisoning, energy-drink
  crash. Messy eating (stains), leftovers, taste & mood. **No tipping system.**

### Food & drink catalogue
- Gas station: chips, candy, jerky, roller hot dogs (poisoning risk), microwave
  burritos, soda, energy drinks, beer six-packs, cheap whiskey.
- Grocery: eggs, bread, milk, pasta, rice, ramen, chicken, steak, veggies, fruit,
  cheese, frozen pizza, cereal (spoils in days). Free samples.
- Fast food & drive-thru: burgers, fries, fried chicken, tacos, pizza slices, shakes.
- Casino buffet (all-you-can-eat; overeat → slow/sick). 24-hour diner (pancakes,
  bacon & eggs, bottomless coffee, pie). Basque family-style restaurant (Reno
  classic). Steakhouse & sushi (dates). Night food trucks. Delivery via phone/PC.
- Bar: beer on tap, cocktails, whiskey shots, peanuts. Casino comp drinks.
- Dumpster food (risky). Other cities: Macau egg tarts & pork chop buns, New Orleans
  beignets & gumbo, Tahoe hot cocoa.
- Drinks: tap water (free at home), coffee (energy + bladder), energy drinks,
  soda, juice, milk, wine, beer, liquor.

## 7. Phone & computer

- Start with a **cracked old budget Android** (laggy, battery dies fast — charge at
  home or in the car; dead phone = no map/time/taxi). Buy: Samsung Galaxy, **iPhone**
  (iOS-style UI), flip phone (week-long battery, no apps). Real phone UI look.
- Apps: texts & calls (partner, NPCs, loan shark; call taxi/ambulance/pizza), bank &
  bills, map & GPS, camera & social app (NPCs comment), **dating app** (catfish,
  scammers), streaming, stocks, Ring cam, security app, dark-web app.
- No watch at start — pull out the phone to check time. Wristwatches (plastic →
  gold → diamond) show a realistic watch face. **Casinos have no clocks.**
- PC (buy one): GPU upgrades (better PC games, crypto mining → big power bill),
  game store (Steam-like, downloads take time, original playable mini-games),
  online shopping (delivery truck, physics boxes), viruses & scams (FREE_MONEY.exe,
  ransomware, stolen bank money; antivirus or repair shop), **real live stock prices**
  (simulated fallback if the data breaks) + meme crypto, online casinos (some scams),
  **stream your gambling** (webcam + GPU, viewers grow slowly, viral moments),
  **hacking** (dark-web tools, phishing NPCs; traceable, FBI).
- Consoles: PlayStation 5, Xbox Series X, Nintendo Switch 2, retro consoles from the
  pawn shop (sometimes broken). Games on them are original mini-games.

## 8. Money

- Start with **$100** cash. No car.
- Earning (all hard): gambling; scavenging (cans/bottles, couch & vending coins,
  lost wallets — return or keep); pawn shop (haggling, **30-day pawn loans**); odd-job
  mini-games (pizza delivery, mowing, dishwashing); **real jobs** with shifts, paychecks
  every 2 weeks, **promotions** (e.g. casino janitor → cocktail server → dealer → pit
  boss → manager), fired for being late/drunk/smelly; loan shark (huge interest,
  goons); businesses (hot dog stand → laundromat → bar → casino; staff steal,
  robberies, bankruptcy); landlord (bad tenants); own slot machines in bars;
  streaming; busking (guitar rhythm game); scams; crime.
- Banking: account (safe from robbers), ATM fees, savings interest, **credit card
  with interest, credit score** (bad score → no nice rentals / bank loans → loan shark).
- Taxes on big wins (form over $1,200, ~24%), audits weeks later if dodged.
- Debt from fines, hospital, lawyers, loans.
- Bribes: bouncers, cops (may arrest you for bribery), dealers (snitch if caught),
  motel clerk / landlords.

## 9. Gambling

- Games: slots (Classic Fruit, Wild West Gold, Space & Aliens, Dragon & Fortune),
  roulette (physics ball), blackjack (card counting), Texas Hold'em vs NPCs/friends,
  craps, **baccarat** (Macau VIP, card squeeze), video poker at bars, coin flip (true
  50/50), dice duel, high-low, big wheel, scratch cards & lottery (CA border), horse
  racing, rubber-duck races, betting on NPC fights, plinko, crash rocket, pachinko,
  coin pusher, keno, **sportsbook** (simulated games on TV walls), bar bets (pool,
  darts, arm wrestling, beer pong), back-alley dice & illegal card games (raids).
  **All games get max polish.**
- Odds: **real house edges** + real casino tricks (near misses, free drinks, no
  clocks or windows).
- Betting: **real chips** — buy at the cashier cage, chips are physical pocket items
  (can be stolen/dropped), click chip stacks or ALL IN, cash out at the cage. Any
  amount or everything.
- Playing zooms the camera into a **cinematic close-up** (hands visible).
- Heat & cheating: count cards, loaded dice, slot-hacking gadget; caught → back room,
  banned, arrested.
- Big jackpots: sirens/lights/crowd/hand-pay, taxes, robbers may follow you out,
  fame (DJ, NPCs ask for money, your ex texts). NPCs decide their own actions.
- Players club card & comps (buffet, room, shows, personal host for whales), valet
  parking (secret joyrides), fortune teller (mostly a scam), superstitions (boost
  mood/confidence only, never odds).
- Venue hours differ (e.g. slot parlor 8 AM–10 PM, big casino 2 PM–4 AM, back-alley
  den 11 PM–5 AM). Main Reno casino: **the Golden Sierra** (mountain-lodge glam:
  stone, gold, waterfall lobby, blacked-out windows at night). Dress codes in VIP.
- NPCs occupy machines — wait, queue, ask, or bribe them to leave.

## 10. NPCs & relationships

- **Living town, full lives**: names, routines, homes, memories, gossip; they date,
  marry, break up, get rich/broke, get evicted, go to jail, move, die; new people
  move in; radio/news report it. Some cheat, beg, or lend money.
- **Type-chat with every NPC** (offline "brain", as smart as possible). Every person
  has their own personality and feelings — some love you, some hate you.
- Voices (Settings): most-human free browser TTS by default with per-NPC pitch/speed,
  or cute gibberish, or text only. Your character says what you type in their voice.
  The owner will supply recorded voice files for some lines later.
- Swearing: bleeped by default, Settings toggle to uncensor.
- Relationships (any gender, gay couples included): dating & gifts, dating app,
  move in, drama & breakups (they can take half), marriage (chapel incl. drive-thru),
  lucky kiss / dice blowing, partner joins you gambling.
- Kids/adoption: costs money, child services if neglected, **real-speed aging**.

## 11. Crime & law

- Fights: punch/shove/grab; security tosses you out & bans you for the day; cops;
  injuries & hospital bills; debt. **Jail only if you kill someone.**
- Weapons: legal gun store (license, waiting period, background check — fails with a
  record) and black market; knives; stabbings & shootings with body-part damage.
- Crimes: pickpocketing (timing mini-game), car theft (hot-wire, sell at junkyard),
  shoplifting (cameras, clerks), casino heist (solo or with friends), scams (shell
  game / three-card monte, fake goods, borrow & vanish), hacking, vandalism.
  You also get scammed (fake tickets, rigged games, warranty calls, phishing).
- Breaking stuff: everything shatters with physics; vandalism charges, damage bills;
  janitor NPCs sweep up.
- Police: **investigations** — witnesses, cameras, evidence; arrest at home days later;
  masks/hoodies help.
- Jail: trial (lawyer → debt), **playable jail** (ramen/soap currency gambling, yard
  fights), life falls apart while inside (eviction, partner leaves, pets to shelter).
- Gangs with territory; you **can join** (protection, discounts, backup; hard to
  leave; rivals and cops target you).

## 12. Cars & radio

- Start with no car: walk, bus, taxi, then a sketchy used-car lot.
- Full car life: gas, dents/smoke, repairs, upgrades, breakdowns, parking tickets,
  speed cameras, police chases, insurance, theft, impound, **repo man** on missed
  payments.
- Real brands. Types: used beaters, pickups & SUVs, muscle & sports, luxury &
  supercars. Mods: paint & wraps, engine & tires, neon & rims, sound system (bass
  shakes the mirrors).
- Radio (real royalty-free recordings, each station its own DJ): jazz & lounge,
  country, synthwave, talk radio (call-ins, town news, your story), hip-hop, rock,
  Latin, oldies. Plus **"Rev or Dead"** — two guys arguing about cars and cussing at
  each other (AI voices for now, owner's voice lines later).

## 13. Pets

- Dogs (many breeds), cats (many breeds), parrot, exotics (snake, mini pig, lizard,
  golden fish), shelter adoption, street strays.
- Full pet life: food, water, walks, love, vet bills, aging, running away, death,
  shelter if you're jailed.

## 14. Social, nightlife, progress

- Endless sandbox. Achievements (100+, funny), life stats book, friend leaderboard.
- Morning newspaper on the doorstep, nightly auto-diary, busking.
- Nightlife: karaoke, dance club, bowling & arcade, casino shows.

## 15. Multiplayer

- Online **room codes** (peer-to-peer), **up to 8 players**.
- Friends **bring their own character** (counts in their save).
- Play each other (poker/blackjack/coin flips), lend & owe money, visit houses,
  fight & race, **cheat each other** (caught via visible animations).
- **Proximity voice chat** (muffled through walls, echo in bathrooms, radio-ish in cars).

## 16. Build order (each layer fully polished before the next)

1. Core: menu & settings, character creator, motel room, Reno you walk/drive,
   casino & games, betting/chips, clock/hours, needs, sleep, music & sound,
   collisions, jiggle, breakables.
2. Living town: NPC routines, fights/security/cops, drinking, stores, pawn shop,
   scavenging, loan shark.
3. Life: chat brains, dating, phone, pets, moods & emotes.
4. Stuff: computer/store/viruses/stocks, GPUs & consoles, furniture, houses, car life.
5. Online friends: room codes, voice chat.

---

## 17. Later additions (rounds 39–43)

- **Smoking**: Nevada casinos allow it → smoky haze, NPC smokers; player can buy
  cigarettes/vapes with real downsides (addiction, cough, smelly clothes, cost, health).
- **Real disasters**: summer wildfire smoke (orange sky, coughing, road closures),
  earthquakes (stuff falls, slots rattle, cracked walls), Truckee River floods,
  blizzards (Tahoe highway closures, tire chains).
- **Wildlife**: wild mustangs near Reno (roads at night), Tahoe black bears (break into
  cars/trash), coyotes, jackrabbits, quail, rattlesnakes, bayou alligators.
- **Macau languages**: Cantonese/Portuguese NPCs and signs; translator app or gestures;
  casino staff speak English.
- **Health extras**: teeth & dentist (cavities, toothache), sunburn & sunscreen, pollen
  allergies, eyesight & glasses (break in fights).
- **Chores**: laundry (laundromat coins or own washer), dishes (roaches, smell, partner
  mad), trash day (stink, bugs, bears), cleaning (mood) or hire a maid.
- **Mail**: paper bills & FINAL NOTICEs, junk mail, credit-card offers, casino promo
  mailers with free play, jury duty summons (fine if skipped), letters (NPCs, love
  notes, loan-shark threats, court).
- **Neighbors**: noise complaints, HOA fines in fancy areas, friendly neighbors (food,
  pet-sitting, loans), nosy neighbors (police witnesses).
- **Hobbies**: fishing (license, game warden, cook your catch), skiing & snowboarding at
  Tahoe, golf (bet on holes), hiking & camping.
- **Fitness**: gym membership (sore muscles), boxing gym (sparring, amateur fights you
  can bet on), pickup basketball, swimming (pools, icy Tahoe, Truckee River tubing).
- **School**: University of Nevada, Reno and trade school (tuition, student loans) unlock
  better jobs (nurse, electrician, accountant…).
- **Court sentences**: community service (orange vest), probation (alcohol tests),
  ankle monitor (house arrest), fines & court fees (unpaid → warrants).
- **Realism relocations**: live horse racing at the New Orleans Fair Grounds; Reno uses a
  race book with TV simulcasts; plinko & crash only in online casinos (PC/phone); coin
  pushers in the arcade (prizes); keno in Reno casinos.
- **Tokyo, Japan** added (passport, flight) for real pachinko parlors.
- **Tournaments/events**: World Series of Poker (Vegas, summer), Macau high-roller
  rooms, weekly local Reno tournaments, March Madness sportsbook frenzy.
- **City events**: Mardi Gras (New Orleans), Chinese New Year (Macau, red envelopes),
  Macau Grand Prix (November street race, bettable), Vegas New Year's rooftop fireworks.
- **Second homes** in other cities (Tahoe cabin, Vegas condo, Macau penthouse…) with
  their own bills, break-ins and property taxes.
- Radio also has hip-hop, rock, Latin and oldies stations.
- Real sports teams can be named, but players are made-up people.

## 18. Later additions (rounds 44–46)

- **More crimes**: burglary (lock picking, windows; alarms, dogs, Ring cams, owners wake),
  mugging (victims fight back / armed), bank robbery (dye packs, FBI), carjacking.
- **Tax day (April 15)**: file on the PC (TurboTax) or pay an accountant; report gambling,
  job and business income; lying risks audits and fines.
- **Insurance**: health (~$400/mo), car (required by Nevada law; uninsured → fines,
  impound), renters/home (burglary, fire, flood), pet and phone insurance.
- **Bills**: phone plan (no plan = no data off Wi-Fi), home internet, slow motel Wi-Fi,
  free casino Wi-Fi; unpaid → shut off.
- **Real family**: parents call/text, siblings in other states, borrow money (they get
  disappointed), holiday visits, they age and can pass away.
- **Traffic**: rush hour, road construction & detours, NPC crashes & road rage, city
  buses, school zones.
- **Driving details**: seatbelts (tickets; ejection in big crashes), signals & traffic
  laws, maintenance (oil, tire pressure, winter battery, warning lights), manual cars
  (stalling).
- **Police extras**: weekend DUI checkpoints, car searches, speed traps, off-duty cops in
  casinos.
- **Skills by real practice** (no XP bars): cards, driving, cooking, fighting, talking
  get visibly better with practice and rusty without.
- **Rev or Dead hosts**: **Big Mike** (trucks & muscle cars) and **Danny** (only likes
  Japanese cars) — they hate each other's taste.
- Starting motel: **The Starlite Motel** — old neon sign with burnt-out letters
  ("STA LITE MO EL" at night).
- **Real friendships**: hanging out builds best friends who help move, lend money, cover
  for you — or betray you, steal, drift away, fall out over money.

## 19. Later additions (rounds 47–49)

- **Radio**: songs **with singing** (royalty-free vocal tracks; more repeats) and **ad
  breaks** for in-game local businesses (used-car lot, injury lawyer, pawn shop, Golden
  Sierra buffet) that mention current deals.
- **Marriage money**: joint bank account (partner sees every bet), prenups, divorce court
  (Nevada splits everything in half, alimony, custody of kids & pets), partner has their
  own job and income.
- **Holidays & parties**: decorating (neighbors judge), trick-or-treaters (no candy → house
  egged), birthday parties (NPC or online guests; nobody showing up hurts), gift giving.
- **Casino credit**: markers (unpaid = bad check = felony in Nevada), credit-card cash
  advances at the cage (~5% fee + instant interest), casino ATMs ($8 fee).
- **Self-exclusion**: ban yourself from casinos (recovery); sneaking back in → removed,
  winnings confiscated.
- **Slots pay in TITO tickets** (physical pocket items, cash at kiosks, can be lost/stolen).
- **Sportsbook**: straight bets, point spreads, parlays, live in-game betting, prop bets.
- **Time keeps going while the game is closed** (1 real hour = 1.25 game days). Your
  character **lives on autopilot**: sleeps, eats from the fridge, goes to work, pays rent
  if they have cash, may even gamble if addicted. On return, the phone is full of
  notifications about what happened. (Implementation: catch-up simulation on load.)
- **Therapy**: weekly paid sessions (insurance helps) slowly reduce stress, depression and
  cravings; type-chat with the therapist.
- **Influencer fame**: Instagram/TikTok posts, slow follower growth, viral moments, brand
  deals, haters, drama, getting canceled.
- **Memberships**: Costco (cheap bulk; needs car & fridge space), Amazon Prime, country
  club, streaming subscriptions (keep charging if you forget to cancel).

## 20. Later additions (rounds 50–52)

- **Screen effects**: rain/snow on the lens, film grain & vignette, motion blur, lens flare
  & neon bloom.
- **Driving camera**: inside the car (driver's-seat view with dashboard, wheel, mirrors).
- **Death moment**: heartbeat slows, sound muffles, vision blurs and tunnels to black →
  obituary.
- **Sound**: room echo/reverb by space, muffled through walls/doors (neighbors' TV), surface
  footsteps (carpet, tile, wood, gravel, snow, puddles), full 3D positional audio.
- **Table realism**: real hand signals at blackjack (tap = hit, wave = stand), throw craps
  dice with a mouse flick (must hit the back wall), hourly dealer rotation with
  personalities, pit boss tracking bets and watching winners.
- In-game phone **photos also download to the player's real computer**.
- **Subtitles off by default** (Settings toggle).
- **Creator details**: freckles, moles, birthmarks, acne, wrinkles; scars (chosen + earned
  permanently where real injuries happen); body hair & daily stubble; glasses, contacts,
  hearing aids, heterochromia.
- **Plants**: house plants (mood, die without water), vegetable garden (save money; rabbits,
  frost, heat), lawn care (HOA fines, summer drought).
- **Messy car interior**: wrappers, cups, smell, drunk passengers vomit; clean it or pay for
  a car wash/detailing.
- **Yard sales** (sell & buy, early haggling NPCs, thieves, rare finds).
- **Facebook Marketplace / Craigslist** (deals, scams, no-shows, dangerous meetups).

## 21. Later additions (rounds 53–54)

- **Storage-unit auctions** (Storage Wars style): peek, bid against NPCs, haul it out yourself.
- **Auctions**: police auctions of seized goods, as-is car auctions, house foreclosures
  (maybe NPCs you know), art & antiques (fakes exist).
- **Metal detecting** in the desert and old mining towns (bottle caps, old coins, silver
  nuggets, vault clues; no digging on private land).
- **More table games**: sic bo (Macau), pai gow poker, three card poker, bingo hall nights.
- **Real Reno casino names** (Peppermill, Atlantis, Eldorado, Circus Circus, Grand Sierra
  Resort…) on the buildings, with original interior designs. The planned "Golden Sierra"
  becomes the **Grand Sierra Resort**. (Real industry practices like comps and no clocks
  are fine; never depict a real casino as rigging games.)
- **Housing extras**: RV / van life (RV parks or free desert camping), homeless shelter
  (curfew, theft, noise), couch-surfing at friends', Airbnb hosting.
- **Pet extras**: tricks (practice with treats), pet clothes (winter sweaters, costumes),
  dog park (meet dates; dog fights), pet social-media fame.
- **Sports-betting app** requires in-person sign-up with ID at a casino sportsbook, then
  works only inside Nevada.

## 22. Later additions (rounds 55–56)

- **Broke-life money**: plasma donation (~$40–70, twice a week, dizzy after), gig apps
  (DoorDash, Uber, Instacart — your car, gas & wear, ratings, non-tippers), paid medical
  studies (side effects), panhandling (pennies, judgement, mood hit).
- **Free help**: weekly food bank (long line), public library (free computers, Wi-Fi,
  charging, warm seat; closes at night), free clinic (hours of waiting), downtown soup
  kitchen (evening hot meal).
- **Payday loans & car title loans** (300%+ APR; title loan → they take your car).
- **Transit**: real Amtrak California Zephyr stop in downtown Reno, Greyhound buses, RTC
  city buses.
- **Dating realism**: ghosting, your partner can cheat on you (find texts on their phone),
  jealousy & exes, long-distance strain (video calls).
- **Original PC/console games**: retro drift racer, FPS arena shooter (online with
  friends), platformer & falling-block puzzle, short horror game (makes your character
  jumpy if played at night).
- **Weddings**: Vegas Elvis-impersonator chapel, courthouse, big planned wedding (venue,
  food, DJ, outfits, guests, reception drama), Tahoe lakeside.
- **Vacations** (resort areas, not full cities): Hawaii beach resort (surf, luau, sunburn),
  Cancun all-inclusive (passport, included drinks, street-seller scams), Yosemite
  national park (camping, bears, waterfalls).
