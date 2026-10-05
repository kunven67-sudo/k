# GAMBLE — Design Bible

*A Loaded Dice Studios game.* Virtual money only — no real money can be won or lost.

This file records every design decision agreed with the game's owner during the
question rounds. It is the source of truth when building. **Golden rule: when a
choice is about realism, pick the MOST realistic option.** Any new option shown
to the owner must be tagged 🟢 least realistic / 🟡 realistic / 🔴 most realistic.
**Second golden rule: how people behave ALWAYS depends on the person.** Every NPC
(coworkers, bosses, partners, family, strangers) has their own personality, so reactions,
expectations and habits vary per individual — never one fixed rule for everyone.
**Third golden rule: features depend on the specific thing.** Cars, phones, houses,
appliances and other items each have their own real features (e.g. newer cars have
auto headlights/wipers, built-in navigation/CarPlay and digital dashboards; old beaters have
manual everything and broken gauges).
**Fourth golden rule: EVERYTHING depends on the situation.** Outcomes are never fixed — they
come from the simulation's circumstances (e.g. porch pirates are deterred or caught only if you
have a Ring cam; a witness only matters if someone actually saw it).

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

## 23. Later additions (rounds 57–58)

- **More real Reno events**: Reno Rodeo (June; bet on riders, ride a bull), Burning Man
  (late August; Reno fills with campers, stores sell out; you can go — tickets, dust storms,
  art cars), Artown (July free outdoor shows), mechanical bulls in country bars year-round.
- **Spanish-speaking NPCs** (some bilingual, bilingual signs; type Spanish → reply in Spanish).
- **Good citizen**: call 911 (cops/ambulance/fire respond), testify in court (day off work;
  criminal's friends may retaliate), CPR timing mini-game & helping people (push stuck cars),
  donating & volunteering (mood + reputation).
- **Real sky**: real Reno sunrise/sunset times per date, real moon phases, real
  constellations (far more stars in the desert).
- **Web**: Google search (hours, locations, guides, NPC news), YouTube (original clips,
  tutorials like card counting/recipes, your uploaded replays), Reddit (gossip, wrong tips,
  complaints about you), news sites.
- **Pay apps**: Venmo, Cash App, Zelle — send/request with NPCs and friends; irreversible;
  "sent too much" scams.
- **Grief**: days/weeks of low mood, funerals, memories, their belongings remain; therapy &
  friends help.
- **Retirement**: Social Security from 62+ (more with work history), 401k with company match
  (early withdrawal penalty), visible aging (slower, cane, gray hair, eyesight, shaky hands at
  the table), retirement homes (weekly bingo).

## 24. Later additions (rounds 59–60)

- **Debt consequences**: collection calls/texts (even at work), wage garnishment, small
  claims court (sue or be sued, argue your case), bankruptcy (most debt wiped, lose stuff,
  credit wrecked ~10 years).
- **Identity theft** after a stolen wallet: cards opened in your name, credit score tanks;
  freeze credit + police report, takes weeks.
- **Phone damage depends on the model** (water resistance, toughness): water damage (rain,
  puddles, toilet → rice), spreading cracks/dead touch zones, battery aging, street theft
  (Find My Phone).
- **Car paperwork**: yearly DMV registration, Nevada smog checks, license renewal; expired →
  tickets, possible impound.
- **Home problems**: frozen/burst pipes in winter, roof leaks & mold (sickness), appliance
  breakdowns (fridge → spoiled food, washer floods, water heater → cold showers), DIY fixes
  via YouTube tutorials (may make it worse) or pricey pros.
- **Renting**: lazy landlords (slow repairs), security deposits (kept for damage), yearly
  rent increases, real eviction process (notice → court → sheriff lockout → stuff on curb).
- **Thermostat**: heating/AC cost a lot on the power bill; turning them off → freeze/sweat.
- **Moving**: U-Haul DIY (carry boxes with physics, friends help for pizza), hired movers
  (fast, pricey, may break/"lose" stuff), many small car trips.

## 25. Later additions (rounds 61–62)

- **NPC brains**: they can lie (some badly), you haggle by typing (politeness changes prices),
  gossip spreads around town, long memory of promises/favors — and **realistic forgetting**
  (small details fade, older NPCs forget more, drunk NPCs forget the night).
- **Texting**: per-NPC style (typos, slang, emojis, lowercase; grandma in ALL CAPS), read
  receipts & left-on-read, typing bubbles that vanish, slow replies, voice messages in
  their voices, group chats (family, friends, online friends).
- **US customs**: cash over $10,000 must be declared when re-entering the US; hidden and
  caught → seized + fines.
- **Travel problems**: weather delays/cancellations (sleep at the airport), overbooked
  flights (bumped → voucher, or volunteer for cash), random TSA bag checks (forgotten knife
  = trouble), lost passport abroad → US embassy emergency passport (days).
- Japan pachinko uses the real prize-exchange system (win balls → prizes → sold at a
  separate window); Tokyo has Japanese language/signs and yen like Macau's setup.
- **Instruments**: guitar, piano (casino lounge piano if allowed), drums (noise complaints,
  cops at night), DJ decks (party/club gigs).
- **Hobbies 2**: skill books (poker strategy, cooking, car repair), painting (sell at Artown /
  online), esports tournaments for prize money, collecting & reselling (sneakers, trading
  cards, coins, limited drops).
- **Grooming**: makeup for anyone (smears in tears/rain), hair dye (roots grow out), nails
  (chip over days), cologne/perfume (too much → people cough).
- **Phone gacha games** with in-app purchases and loot boxes that drain in-game cash.

## 26. Later additions (rounds 63–64)

- **Guns+**: shooting range (ammo & lane fees), Nevada concealed-carry permit (class,
  fingerprints, wait; carrying without it is a crime; casinos often ban guns), hunting
  season (license, tags, game warden, cook your catch), gun safe (unlocked guns get stolen;
  danger with kids).
- **Daylight saving time** (March/November): phone auto-updates, wristwatch doesn't.
- **Car crashes**: airbags (stun), totaled cars (insurance payout only if insured), info
  swap & at-fault claims (premiums rise), whiplash (injury-lawyer calls), hit-and-run is a
  crime (witnesses/cameras catch plates).
- **Kids+**: expensive daycare, school (homework, parent-teacher meetings, calls),
  babysitters (good or glued to their phone), kids copy your habits (swearing, drinking,
  gambling, kindness), kid sick days (miss work).
- **Winter**: shovel the driveway, scrape iced windshields, black ice (ragdoll slips, sliding
  cars), stuck in snow (push, dig, tow).
- **Summer**: scorching car seats/wheel, leaving pets/kids in hot cars is deadly and a crime
  (bystanders break windows, call cops), heat stroke, A/C breakdowns during heat waves.
- **PC annoyances**: forced Windows updates, blue screens (lose unsaved PC-game progress),
  slow Wi-Fi & router restarts, printer jams.
- **Jail life**: collect calls (cost the receiver; some don't answer), commissary funded by
  others, visits through glass (incl. online friends), cellmates with personalities you can
  type-chat with.

## 27. Later additions (rounds 65–66)

- **Body stuff**: yawns (contagious to NPCs) & stretches, hiccups & sneezes, occasional
  burps/farts after big meals or beer (NOT constant) plus an on-purpose button, nervous
  sweating & shaky voice before big bets or lying to cops.
- **Clothes wear out**: fade, rip in fights, holes, stains, shoes wear down; cheap clothes
  wear faster.
- **Dealer mistakes**: occasional over/underpays — point it out (dealer likes you) or keep it
  (cameras may notice).
- **Forgotten slot tickets/credits** left in machines: keeping them is theft in Nevada (camera
  risk) or turn them in to security.
- **CHANGE — casinos & bars are open 24/7** (real Nevada). Supersedes the earlier "venue
  closing times" for big casinos: nobody kicks you out; exhaustion, hunger, bladder, money
  and your job force you to leave. Small venues (slot parlors, back-alley den, bingo hall,
  stores) keep real hours.
- **Casino promos**: hot-seat drawings, slot tournaments, birthday free play, car giveaway
  drawings.
- **Claw machines** grab strongly only 1 in X tries (real payout settings).
- **Hotel stays**: room service (service charge), minibar ($12 water, auto-charged),
  housekeeping (Do Not Disturb; valuables risk), 11 AM checkout, late fees, hidden resort fees.

## 28. Later additions (rounds 67–68)

- Real Nevada slot machines also in **grocery stores, gas stations, laundromats and the Reno
  airport**.
- **Talk to NPCs with your real voice** (mic → speech recognition, best in Chrome) in addition
  to typing.
- **Mic loudness matters**: yelling turns/scares NPCs, whispering keeps sneaking quiet, noise
  wakes a sleeping partner.
- **Restaurants**: wait lists & phone reservations, dine & dash (crime; waiter chases,
  cameras), splitting checks (Venmo IOUs), sending food back (polite → fixed, rude → 🤢).
- **Date bills**: each NPC has their own expectation (you pay / split / offended if you pay).
- **Your personality grows from your actions** (kinder, sneakier…), changing NPC views and
  your character's small habits.
- **Phobias** (per character): flying, heights, spiders & bugs, dogs.
- **Side bets on anything**: eating contests, dares, foot/car/bike races, handshake bets
  (people may not pay up).
- **Quitting habits**: AA meetings with a sponsor, nicotine patches/gum (cranky days), sober
  streak app, relapse from stress or temptation.

## 29. Later additions (rounds 69–70)

- **Economy**: ~3%/year inflation (cash under the mattress loses value), booms & recessions
  (layoffs, fewer tourists, quieter casinos, stock crashes, cheaper houses), changing home
  values (buy low/sell high, underwater mortgages).
- **Real wages**: Nevada minimum wage ($12/hr), paycheck tax withholding, tip-based jobs
  (dealers/servers) whose income varies nightly — big winners tip big. (The player still
  doesn't have a tipping mechanic as a customer.)
- **Car buying**: test drives (talkative salesman), haggle by typing/voice ("let me check with
  my manager"), credit-score-based financing, extended-warranty upsells & hidden fees.
- **Electric cars** (Tesla etc.): charging stations / home charger, slow charging, big range
  loss in freezing Reno winters.
- **Uber/Lyft surge pricing** (late night, bad weather, after events).
- **Motorcycle laws**: license endorsement test at the DMV; Nevada helmet law (tickets, worse
  crash injuries without one).

## 30. Later additions (round 71) — being the house

- **Home poker games**: invite NPCs/online friends; friendly games legal, taking a rake is
  illegal in Nevada (neighbors snitch, police raids).
- **Illegal bookie**: take off-the-books sports bets; you pay when everyone wins; collecting
  is dangerous; FBI investigates big operations.
- **Lend money to NPCs** with interest: some repay, some vanish, some get angry; excessive
  interest = illegal loan sharking.
- **Card-counting teams** with online friends (MIT-style spotter signals the big player via
  gesture/emote); legal but casinos ban caught teams.

## 31. Later additions (rounds 72–73)

- Downtown Reno **casino skyways** (Eldorado ↔ Silver Legacy ↔ Circus Circus).
- **Co-ownership with online friends**: houses (split mortgage/bills), businesses (split
  profit/loss), shared bank accounts (can be drained), shared cars (crasher pays).
- **Friends can betray** each other: steal from houses, drain accounts, scam, snitch.
- **Facial recognition & disguises**: wigs/glasses/fake mustaches to sneak in after a ban;
  cameras may still match you → trespassing charges.
- **Crime Stoppers**: news shows blurry suspect photos with cash rewards; NPCs who know you
  may call it in; you can tip off police about others for money.
- **Relationship dates depend on the person**: each NPC has their own expectations about
  Valentine's Day, anniversaries, Mother's/Father's Day, birthdays.
- **Prevention**: yearly flu shots (sore arm), checkups (blood pressure, liver), dental
  cleanings every 6 months, vitamins (tiny boost).
- **Emergency phone alerts** (flash flood, wildfire, blizzard, Amber) blast even on silent.
- **Long-term health**: years of stress, smoking, drinking and junk food raise later-life
  risk of heart attacks, liver and lung problems; healthy living lowers it.

## 32. Later additions (round 74)

- **Work life** (all behavior depends on the person): coworkers (friends, gossips, lunch
  thieves, crushes), bosses (good, terrible, micromanagers; control promotions), limited
  sick days & PTO, verbal → written → final warnings, two weeks' notice.
- **Job interviews** by typing or voice; outfit, smell and answers matter; background checks
  (criminal records block some jobs).
- **Casino worker unions** (real Culinary Union): dues, better pay/protection, strikes and
  picket lines (coworkers remember who crossed).
- **Nevada gaming work card**: fingerprints + fee from the sheriff before casino jobs; serious
  records can block it; gambling at your own casino gets you fired.

## 33. Owner's taste & mobile (rounds 75–76)

- **Feel references**: GTA 5 (open city, driving, crime, talking radio), The Sims 4 (needs,
  homes, relationships), Schedule I (build up from nothing with friends), Gang Beasts / Fall
  Guys (floppy jiggle chaos). From the Steam gambling-with-friends game they love: playing
  with friends, the gambling rush, funny chaos.
- **Target feelings — all of them**: "one more spin", "this feels like real life",
  "BRO did you see that?!", "I lost EVERYTHING".
- **Dealbreakers to avoid**: lag, looking AI-made/cheap, bad collisions (walking through
  things / invisible walls), getting boring.
- **MOBILE SUPPORT (new requirement)**: the owner's friend plays on a **newer iPhone
  (13+)**, so GAMBLE must run in mobile Safari and **cross-play with PC** in online rooms.
  - Touch controls: **twin virtual joysticks** (left = move, right = camera) + buttons by
    default; **tap-to-move** as a Settings option.
  - **Smooth first on phones**: adaptive quality (fewer shadows/effects, shorter view
    distance) while PC keeps max graphics.
  - **No controller support yet** (maybe later).

## 34. First morning (round 77)

- The cracked-phone video shows a **parking-garage brawl** at a casino — someone gets badly
  hurt, and you might be IN the video.
- With the video you can: give it to police (reward; may testify; they ask what you were
  doing at 3 AM), sell it to local TV news (quick cash), post it online (viral or trouble),
  or delete it.
- Day-1 pocket clue: **a napkin with a name and phone number** (the only clue).
  - ⏳ **PENDING — do NOT build yet:** calling the number plays the owner's own recorded
    voice line and awards a "You got pranked" trophy. Wait for the owner's voice file.
- **Installable app (PWA)**: Add to Home Screen on iPhone → own icon, full screen.

## 35. Round 78

- Day 1: you wake up **hurt** — black eye, sore knuckles, ripped shirt (hint you were in the
  brawl). You CAN change clothes (a duffel bag in the motel room has a couple of outfits) and
  heal (bruises fade over a few days; ice packs/bandages from the gas station speed it up).
- **Online hosting is free peer-to-peer**: the host's computer runs the room; when the host
  quits, everyone returns to their own world with their progress saved.
- A joining friend **spawns at their own home** inside the host's Reno (their own motel
  room/house) and must travel to meet up.
- **Name tags above players' heads** online.

## 36. Round 79 — never boring

- **Rich life**: buy a whole casino (set odds within Nevada law, staff, gaming regulators,
  robberies), Tahoe yacht, helicopter, supercar collection, mansion & pool, donations that put
  your name on UNR buildings / hospital wings, rich-people problems (paparazzi, gold diggers,
  fake friends, lawsuits, kidnapping risk & bodyguards, huge taxes).
- **Reno places**: Reno Aces minor-league baseball (bet on games), UNR Wolf Pack football &
  basketball (tailgating), National Automobile Museum, movie theater with the made-up movies
  (crowd behavior depends on the person).
- **Rival gambler NPC** who keeps showing up, trash talks, bets against you, competes for
  partners/jobs, remembers every result — can become an enemy or best friend over years.

## 37. Rounds 80–81

- **No cheat codes.** **One life / one character only.** Menus in **English + Spanish**.
- **Physics toys**: ridable shopping carts, wind-blown tumbleweeds bouncing off cars, cones &
  trash cans, downtown pigeons (feed → swarm, run → scatter).
- **Lucky-streak moments**: rare hype build-ups (camera, music, crowd) on hot streaks.
- **Life highlight reel**: the obituary comes with a montage of your best/worst moments.
- **Retro slot museum**: 1950s–1990s-style machines playable at an old casino.
- **NPCs act on what you say — if they want to**: ask anyone (including your kids) to do
  things through chat/voice ("come with me", "leave", "buy me a beer", "stop") and they decide
  based on their personality, mood and relationship with you. You can talk with your kids
  like any NPC, and punch people (fights as already designed).

## 38. Round 82 — game feel

- **Fighting**: real boxing feel — fast-draining stamina, blocking & dodging, aimed hits (head
  / body), staggers and true ragdoll knockouts; boxing-gym training helps.
- **Driving**: **simulation** (BeamNG-like weight, braking, terrifying ice) — still needs to be
  controllable on keyboard and touch.
- **Crash damage**: **soft-body crumple** where you hit (simplified on phones).
- **Walking**: **weighty** (RDR2-like momentum, slower turns, planted feet).
- **Part-by-part car repair** (My Summer Car / Car Mechanic Simulator style): replace tires,
  brakes, windshield, battery, bumpers, headlights, engine parts, etc. — yourself (DIY, can
  go wrong) or at a shop; parts wear and get damaged individually.

## 39. Round 83 — physical interaction

- **Doors, drawers, fridges open physically**: grab & drag with the mouse / swipe on phones
  (Amnesia/Phasmophobia style); doors also swing when walked into.
- **Pockets**: physical view — character pats pockets, camera shows hands holding the contents;
  pick an item to pull it out.
- **Car entry**: full animation every time (unlock, open, sit, close, seatbelt, keys, start).
- **Phone in hand**: held up in the 3D world filling most of the view; world keeps going —
  walking while texting can bump into things/people.
- **Chips are dragged physically** onto felt/roulette numbers (clack & stack physics; ALL IN
  pushes the whole stack).
- **Poker cards are peeked by lifting the corners** — careless peeks can be seen by neighbors.
- **Slots**: SPIN button (modern) or physical lever pull where machines have one; old machines
  are lever-only.
- **Carry drinks/food while walking**; bumps, running, tripping and drunkenness cause spills
  (stains, angry NPCs).
- **Open mic** (always listening when enabled — NPCs hear everything).
- **Real mirror reflections** (bathrooms, mirrored casino walls; simpler on phones).
- **Eavesdropping**: NPCs talk to each other (gossip, machine tips, drama, secrets); get too
  close and they notice.
- **Light switches** in homes (power bill; pitch dark without them).
- **Car features depend on the car**: dashboards (needles, fuel, warning lights, broken gauges
  in beaters), auto vs manual headlights/wipers, built-in navigation/CarPlay with voice
  directions in newer cars; the phone's Google Maps works anywhere (dies with the battery).
- **Pedestrian laws**: crosswalk signals; jaywalking near cops → ticket; cars may not stop.

## 40. Round 87 — style

- **Color mood: natural** real-world colors that change with weather/time (golden sunsets,
  gray rain, orange wildfire smoke).
- **Settings & secondary menus: card-table style** (green felt, chip-shaped buttons).
- **Studio splash: dice roll** — two physics dice tumble and land on 6-6, "Loaded Dice
  Studios" fades in with a clack.
- **Credits: studio only** ("Loaded Dice Studios").

## 41. Round 88

- Newspapers, TV news and radio stations use **made-up names** (they report fictional stories
  about people); all other brands stay real.
- **Character creator happens in a DMV photo booth** — the camera flash at the end takes the
  photo that becomes your ID card in your wallet.
- **NPC nicknames** for you based on your actions ("Lucky", "Broke Boy", "the Hand",
  "Card Shark"), spreading around town.
- **Self radio**: load your own songs (from computer/phone) into a personal car/home station.
- **Vanity license plates** at the DMV (rude ones rejected; memorable to cops & witnesses).
- **Motel room number is random each life** (never 9 or 13).
- **The Starlite is on 4th Street** — Reno's real gritty old motel strip, a short walk from the
  downtown casinos; rough at night.
- **Gambling music: only the casino's own soft background music and machine jingles** (no
  cinematic tension score).
- **All real Reno casinos get equal, maximum detail** — The Row (Eldorado, Silver Legacy, Circus
  Circus with its carnival midway & circus acts, linked by skyways), Grand Sierra Resort,
  Peppermill, Atlantis, etc.
- **Day 1 starts at the 11 AM knock**: the Starlite clerk bangs on the door demanding the $45
  or checkout.
- **Cloud save** (same life on PC and phone): free Firebase (Google) project + sign-in; the owner
  must create the free Firebase project when we reach that phase (walkthrough provided).
  Server timestamps drive the "time keeps going while away" catch-up.
- **Sign-in**: Google or email/password, or **guest** play (device-only) with account linking
  later.
- **Friends list**: add by username, see who's online, one-tap join (room codes still work).
- **Public lobbies** with strangers are allowed (lobby list via the cloud backend) — with report,
  block and mute buttons, and host kick.
- **Leaderboards**: global (all players) + friends tab.
- **Profile picture**: DMV ID photo by default, changeable to any in-game photo.
- Strangers' mics are **open by default** in public lobbies (proximity), mutable per person.
- **Host controls**: death rule (permadeath/hospital), player-vs-player fighting & robbing on/off,
  private/invite-only lock, max players (2–8).
- **Player text chat = nearby speech bubbles only** (far away → text them on the in-game phone).
- **Leaderboard anti-cheat: free best-effort** (sanity checks on impossible values; not
  server-authoritative).
- **Real push notifications** about autopilot life while away (rent due, evicted, partner texted…);
  iPhone requires the home-screen app.
  - Delivery: **free hourly GitHub Actions cron** reads the cloud save and sends web push
    (may arrive up to ~1 hour late).

## 42. Round 97

- **Local elections**: vote for made-up Reno mayor candidates and local measures (casino tax,
  stadium…); results change taxes, police presence, road work.
- **Lost & found**: casino security, bus station, police; honest NPCs may turn items in (or not).
- **Forecasts can be wrong** (real live forecasts vs actual weather).

## 43. Round 98

- **Betting events**: Kentucky Derby (May; packed race book, crazy hats; fly to Louisville to watch
  live — event area only), Vegas boxing/UFC mega-fights (live tickets or sportsbook), World
  Series & NBA Finals, college bowl season (Wolf Pack).
- **Keno runners** in some Reno casinos (play keno from the restaurant/bar).
- **Pharmacies** (CVS, Walgreens): prescriptions (antibiotics, pain meds after injuries;
  insurance helps) and over-the-counter cold meds & bandages.

## 44. Round 99 — real places near Reno

- **Drivable nearby towns**: Virginia City (historic silver-mining town — saloons, mine & ghost
  tours; ties into the hidden silver vault), Carson City (state capital, small casinos, state
  courts), Sparks (Nugget casino, Victorian Square), Truckee CA (just over the border — where
  you buy lottery tickets & scratchers).
- **Local events**: Virginia City camel & ostrich races (September, bettable), Sparks Rib
  Cook-off (Labor Day, eating contests), Street Vibrations motorcycle rally (September),
  Virginia City ghost tours around Halloween (maybe linked to motel room 13).
- **Natural hot springs** near Reno (lower stress, heal sore muscles, date spot).
- Newspaper: **The Truckee Times**. TV news: **KSLV 8 News**. Slot machine names: invented by
  the developer. Radio station names: invented by the developer.

## 45. Round 101

- **Random stranger moments**: tourists asking you to take their photo (phone-theft either way),
  asking directions (help or misdirect), sharing a cab, invitations to parties/bachelor
  parties/poker games (fun or a setup).
- **Hitchhiking** both ways (mostly nice people, some robbers, wild stories).

## 46. Quality bar (round 102)

- **Signature WOW moments to polish first-time**: the first jackpot (sirens, lights, crowd rush,
  character losing it), the first night walk down Virginia Street under the Reno Arch (neon on
  wet streets), the first big fight (punch, stagger, ragdoll KO, security drag-out), the 11 AM
  knock (blurry hungover wake-up, pounding headache, BANG BANG).
- **Anti-"AI look" checklist** (all four are dealbreakers):
  1. No plastic/generic surfaces — every material gets texture, wear, variation.
  2. Never too clean — dirt, trash, cracks, scuffs, stains, clutter everywhere appropriate.
  3. No stiff animation — weight, foot planting, no sliding, secondary motion/jiggle.
  4. No default menus — custom fonts, card-table/slot-machine/phone UIs with personality.
- **Shading: Fortnite-like** — chunky cartoon shapes with physically based materials (real fabric,
  metal, glass, soft skin), real lighting & shadows.
- **Fonts/signage mixed by place** (fancy casinos, retro motels, modern stores); menus use a
  classic casino style on the card-table UI.
- **Strand-like hair** that sways in wind (simplified on phones).
- **Mic speech uses your real voice** coming from your character (others hear it too).
- **Real lip sync** for everyone (NPC TTS, your mic, friends' mics).

## 47. Round 105

- **Reno landmarks**: National Bowling Stadium (silver dome, 78 lanes, bowling bets), Truckee
  River Walk & whitewater park (kayak rapids, Wingfield Park concerts, summer tubing), the
  downtown **train trench** (freight trains, night horns), Midtown murals district (bars, thrift
  stores, food).
- **Alcohol poisoning**: too many shots too fast → pass out, vomit, ambulance; can be deadly
  if nobody helps.
- **Police departments use made-up names** (cops can take bribes in the game).
- **Shopping**: Meadowood Mall, Scheels in Sparks (Ferris wheel & aquarium inside; outdoor gear),
  The Summit outdoor center, Walmart (3 AM vibe) & Target.
- **Activities**: pickleball, climbing/bouldering gym, disc golf (bet per hole), weekly bowling
  league with NPC teammates & trophies.
- **Racing**: legal drag strip outside Reno (bet or race), illegal night street racing (money &
  pink slips; cops, crashes, impound), go-karts, county-fair demolition derby (soft-body).
- **Home games**: board games (Monopoly etc.; arguments, board flips with physics), card games
  (UNO, Go Fish with kids, gin rummy with grandma), jigsaw puzzles (stress relief), home bar games
  (dartboard, pool table, beer pong table).
- **Life events**: bachelor/bachelorette weekends in Vegas, baby showers, graduations (UNR / trade
  school), retirement parties.
- **Tattoos & piercings fully real**: pain flinches, days of healing, regret, expensive laser
  removal; piercings can get infected without cleaning.
- **Parking**: downtown meters (tickets), hourly garages (lost ticket = max fee), towing from
  private lots/red zones, circling for spots on busy weekends.
- **Gas stations**: pay at pump or prepay inside, wrong-fuel engine disasters, drive-off theft
  (cameras catch plates), per-station prices (Costco cheapest, casino-area priciest).
- **Elevators can rarely break** and trap you between floors (emergency button, awkward NPC
  chat, bladder pressure).
- **Porch pirates** steal delivered packages — depends on circumstances (Ring cam deters/records);
  you can steal packages too.
- **Fireworks are banned around Reno** (wildfire risk): buy outside the county, light at home →
  fines, possible brush fires; the official 4th of July show is legal.
- **Wind physics**: hats blow away, umbrellas flip inside out, trash cans tip and scatter, tall
  trucks/RVs sway in highway wind warnings.
- **Stand-up open mic** with your real microphone; crowd laughs/crickets/heckles/boos; good sets
  → paid gigs.
- **Black Friday chaos**: 5 AM lines, doorbuster deals, crowd rushes, fights over the last item
  (ragdoll pile-ups).
- **Betting-system scams**: Martingale books, $500 guru courses — feel like they work, then wipe
  you out; card counting is the only real edge.
- **Comp living**: enough play earns free hotel nights continuously; drops off when play drops.
- **Fraud crimes**: insurance fraud (investigators), check fraud, counterfeit chips (RFID chips →
  likely caught), return fraud (stores flag you).
- **Caffeine addiction**: daily coffee/energy drinks hook you; skipping → headache & crankiness.
- **Drive-in theater** in Sparks (sound via car radio; date spot).
- **Language learning app** (Duolingo): daily practice slowly unlocks understanding of Spanish,
  Cantonese and Japanese NPCs without the translator; skipping days → forgetting.
- **Betting pools**: office lottery pools (winner drama), March Madness brackets, Super Bowl
  squares, season-long fantasy football (online friends too).
- **Prediction markets** (Kalshi-style) on real-life events (snow tomorrow via live weather,
  elections, awards); Nevada regulators may shut them down in-game.
- **Poker staking**: get staked by rich NPCs (split winnings, owe makeup) or stake others.
- **Racehorse syndicate shares**: pay feed/trainer/vet, watch races, win purses or suffer injuries.

## 48. FOOD, DRINKS & FRIDGES (owner focus, rounds 115+)

- **Fridges/freezers** (features depend on the model): motel mini-fridge you start with (tiny, loud
  hum, barely cold, fits a six-pack + leftovers), old used fridges (cheap, noisy, leaky, can die
  in summer), modern side-by-side/French-door with ice & water dispensers (Samsung, LG,
  Whirlpool), chest freezers (bulk Costco meat, hunting/fishing catches, months of storage).
- **Fridge realism**: every item sits physically on shelves/door bins (stacking; items fall out
  if yanked open), interior light, cold fog in summer, door left open warms food and raises the
  bill, forgotten food molds and stinks (bugs), power outages spoil food within hours.
- **Spoilage**: printed expiration dates, visible rot (brown bananas, green bread mold, gray meat,
  wilted lettuce), sniff test (sour milk → gag), freezer burn (safe but tastes bad).
- **Drink temperature**: drinks chill slowly in the fridge, warm beer/soda taste bad (mood hit),
  ice cools fast, hot coffee cools off, drinks forgotten in the freezer explode.
- **Kitchen appliances** (depend on the home): microwave (metal/eggs explode, sparks, fires), stove
  & oven (boil-overs, smoke alarm; gas or electric), air fryer, blender, toaster, coffee maker,
  outdoor grill (propane/charcoal, flare-ups, neighbors drop by).
- **Grocery stores**: carts (wobbly wheel), physical shelf picking, cashier lines & self-checkout
  ("unexpected item in bagging area"), bagging & carrying, weekly sales, mailed coupons, store
  brands vs name brands, real 2026 prices that inflate over time.
- **Drinks**: real brands (Coca-Cola, Pepsi, Dr Pepper, Red Bull, Monster, Gatorade, Starbucks, Bud
  Light, Coors, Modelo, Jack Daniel's…), cocktail mixing at home or bartending (pour amounts
  matter), free and genuinely good Reno tap water (Sierra snowmelt) vs paid bottled water, home
  coffee (drip, Keurig, espresso) and Starbucks/Dutch Bros drive-thrus.
- **Diets depend on the person**: allergies (peanuts, shellfish), intolerances (lactose),
  vegetarian/vegan/keto, favorite foods — for NPCs and for you (set in creator or discovered).
- **Cooking every step**: knife chopping (can cut yourself), cracking eggs (shells fall in),
  seasoning, stirring, flipping; doneness matters (undercooked chicken → food poisoning, overdone
  → burnt).
- **Pantry & cabinets**: dry/canned food lasts months; opened bags go stale; pantry moths & mice.
- **Meal prep**: batch-cook into containers, save money; same food all week bores you; old prep
  spoils.
- **Overeating effects**: food coma after buffets, spicy food (sweat, red face, milk grab,
  heartburn — depends on tolerance), overeating → sick/vomit, sugar rush then crash.
- **Fast food**: drive-thru speaker you talk into (real mic or typing; crackly "repeat that?"),
  the broken McDonald's ice cream machine, app deals & points, wrong/missing items (depends on
  the worker and rush).
- **Graveyard specials**: cheap 2 AM steak & eggs at casino coffee shops (night-shift crowd).
- **Vending machines with physics**: stuck snacks, shaking can tip the machine onto you, eaten
  dollars.
- **Bar tabs**: open with your card; forgetting to close while drunk leaves your card at the bar
  and a shocking bill next morning.
- **Drinking extras**: hangover cures (water, greasy breakfast, electrolytes, sleep; "hair of the
  dog" helps briefly then worsens it), drinking games (flip cup, quarters, beer pong), Reno
  brewery tours & tasting flights, homebrewing (weeks; may taste awful; sell at parties).
- **Food truck business**: used truck, health permit & inspections, cook real orders, park at
  events (Rib Cook-off, Burning Man, bar close-outs), breakdowns, slow rainy days.
- **Thanksgiving deep-fried turkey**: frozen turkey in hot oil → physics fire; done right → best
  turkey ever.

- **Fridge door**: souvenir magnets from visited cities, printed in-game photos, kids' school
  drawings, sticky notes from partner/roommates ("BUY MILK", "we need to talk").
- **Car snacks with physics**: cup-holder drinks slosh/spill on turns, fries fall between seats,
  eating while driving distracts.
- **Pocket food gets squished**: sandwiches squish, chocolate melts in heat, shaken soda explodes.

- **Smart fridges** exist as specific models (e.g. a Samsung Family Hub screen showing contents and
  expiration dates) — features depend on the fridge.
- **Deli & bakery counters**: take a number, order by voice/typing ("half a pound of turkey,
  thin"), custom birthday cakes ordered days ahead.
- **Government help**: SNAP/EBT (groceries only — no beer or hot food; weeks to approve),
  unemployment (layoffs only, not firing for cause; job-search logs), Medicaid (free coverage at
  low income; lost when income rises), housing assistance (months-to-years waitlists).

## 50. HOUSES & FURNITURE (owner focus)

- **Real Reno neighborhoods per tier**: motel on 4th Street, trailers in Sun Valley, apartments in
  Midtown, family houses in the suburbs/Sparks, penthouses in downtown high-rises, mansions in
  south Reno gated golf communities — each with its own crime, noise, neighbors and views.
- **Home buying**: mortgage pre-approval (credit score, income, debts), open houses with a
  commission-hungry realtor and competing NPC buyers, paid home inspections (skip → hidden mold,
  bad roof), down payment, closing costs, paperwork, keys.
- **Full remodels**: knock down walls, add rooms, redo kitchens/bathrooms; contractors (delays,
  overruns, scams) and city permits, or DIY with risk.
- **Flat-pack assembly**: picture instructions, Allen keys, missing screws; built wrong → wobbles
  or collapses. (Reno has no IKEA — nearest is a drive to Sacramento.)

- **Functional furniture**: curtains/blinds (morning sun wakes you; open at night → neighbors &
  burglars see in), couches (naps/pass-outs with worse sleep; coins & lost items under cushions),
  bookshelves (skill books; impress or embarrass dates), rugs (hide stains, damage, items).
- **Hiding cash**: under the mattress (burglars check first), freezer, home safes (bolted or
  carried off whole), secret spots (fake outlets, hollow books, floorboards — partners may find
  them).
- **Garage workshops**: indoor parking (safe from hail/thieves), door openers, tool bench for DIY
  car repair, clutter storage.
- **Pet damage depends on the pet & training**: cats scratch couches, puppies chew shoes/cords,
  parrots chew wood.

- **Bathrooms**: clogged toilets (plunger or overflow), hot water running out (long showers,
  roommates), mirrors fog after hot showers (wipe to see), running out of toilet paper.
- **Home casino room**: owning slot machines at home is legal in Nevada — used slots + poker table
  for friends/guests; you set the odds; charging money would be illegal gambling.
- **Rich-home features**: pool & hot tub (parties, chemicals, winter covers), home theater (movie &
  Super Bowl nights), home gym, wine cellar & home bar (bottles appreciate over years).

- **Trailer life**: own the trailer but pay lot rent (rising; park rules), wind rocks the trailer
  at night, propane refills & rooftop swamp cooler, close-knit park neighbors (dogs, BBQs, gossip —
  depends on the people).
- **Apartment life**: upstairs footsteps/music/arguments (or you get complaints if upstairs),
  shared coin laundry (wet clothes dumped on the dryer), mailroom & package lockers (theft still
  possible), assigned parking (squatters → notes or tows).

## 51. CARS & DRIVING (owner focus)

- **Classic car restoration**: find rusty 60s muscle cars in barns/Marketplace, restore piece by
  piece in the garage (hard-to-find parts), value rises; show at Hot August Nights.
- **Interior accessories**: fuzzy dice on the mirror (physics swing), tree air fresheners (fading),
  jiggling dashboard bobbleheads, seat covers & floor mats.
- **Anti-theft**: car alarms (scare thieves or false 3 AM alarms), steering wheel lock, hidden
  AirTag/GPS tracker to recover stolen cars, dashcams (prove fault, record break-ins).
- **AAA roadside membership**: tows, jump starts, flat tires, lockouts; without it a desert tow
  costs a fortune.

- **Car aging**: sun-faded paint & cracked dashboards (garages/sunshades help), underbody rust from
  winter roads, hail dents when parked outside, depreciation (off-the-lot drop, mileage).
- **License reinstatement**: after suspension, written test + strict road test at the DMV (full
  stops, signals, parallel parking); fail → retry later.
- **Driver communication**: horn taps/long honks, flashing high beams, thank-you waves, rude
  gestures (reactions depend on the person — some follow you).
- Child car seats are required by law when driving kids (real).

- **Reno → Las Vegas road trip on US-95** (real stops): the Clown Motel in Tonopah (next to an old
  cemetery; overnight stays), ghost towns like Goldfield & Rhyolite (explore, metal-detect), the
  Extraterrestrial Highway detour (NV-375 near Area 51 with the alien-themed diner/inn — ties to
  the UFO easter egg), big truck stops (gas, jerky, showers, slot machines).

- **Owner's dream cars (extra detail)**: Ferrari, Lamborghini, Tesla Cybertruck, lifted pickup
  (F-150 / RAM / Silverado).
- **Full traffic stops**: pull over, lights behind you, window down, hands on the wheel, talk by
  voice/typing, hand over license/registration/insurance; outcome depends on your attitude, the
  cop's personality and what's in the car.
- **Rental cars** (Enterprise, Hertz) at destination airports: under-25 fees, damage/fuel/cleaning
  charges.

- **Middle finger emote** on foot (and in cars): NPC reactions depend on the person (laugh,
  ignore, confront).

## 52. PHONE, COMPUTER & PEOPLE (owner focus)

- **Phone details**: passcode & Face ID (depends on phone; shoulder-surfers can learn it), storage
  full (delete or pay for cloud), customization (wallpapers from your photos, ringtones, app layout,
  cases), Do Not Disturb (miss important calls).
- **Call any NPC** by mic or typing; if they don't pick up (depends on the person) leave a real
  voicemail in your voice that they listen to later.
- **PC building**: buy parts online/in store and assemble in 3D (no thermal paste → overheating), or
  buy pre-built/laptops; better parts → smoother PC games & more mining.
- **Relationship stages**: talking → dating → "what are we?" → exclusive → moving in → engaged →
  married; pacing preferences depend on the person (some never want marriage).

- **Computers (each works differently)**: Windows gaming PC (all PC games, viruses, forced updates),
  MacBook (pricey, fewer viruses, fewer games), Chromebook (web/school/streaming only), old pawn-shop
  laptop (slow, dying battery, previous owner's files).
- **Video calls** (FaceTime-style) on phone/PC — they see your face and surroundings.
- **Gender expression depends on the person**: any NPC (and you) can act more feminine, masculine,
  or in between regardless of gender — mannerisms, style, interests vary per individual.

- **Social realism**: friends-of-friends introductions & group drama, regulars who learn your name
  and usual order (barista, bartender, dealer), separate reputations per group (casino regulars,
  coworkers, neighbors, gangs, family), a real diverse Reno crowd (locals, tourists, retirees at
  the slots, college students, all ages & backgrounds).
- **Discord** on phone/PC: NPC community servers ("Reno Poker Night", "Car Meet Reno"), DMs, voice
  channels with online friends.

- **Phone camera**: video recording (evidence, TikToks, fights that can be used against you), zoom
  (blurry on cheap phones) & flash, front-camera selfies with expressions/group crowding, filters &
  edits.
- **Nevada hands-free law**: holding/texting while driving → tickets if seen, distraction & crash
  risk; hands-free calling and CarPlay depend on the car.
- **Smartwatches** (Apple Watch, Galaxy Watch): time (counts as a watch), notifications, heart rate
  (stress), fall detection auto-calls 911 when you're knocked out, daily charging.
- **Headphones/AirPods**: music while walking; reduced awareness of cars, people and danger;
  noise-canceling depends on the model.

## 53. SITTING (owner focus)

- **Sit on anything sittable** (right height & flat enough): chairs, couches, benches, stools, beds,
  curbs, stairs, ledges, fences, car hoods, tables (rude in restaurants), floors and ground (cold in
  snow, hot in summer).
- **Seat physics**: lean back too far → tip over (ragdoll), cheap/old chairs crack or collapse
  (depends on chair & weight), bar stools/office chairs spin, rocking chairs rock, wheeled chairs
  roll, soft cushions squish & jiggle (hard benches don't).
- **Seat social**: "that's my seat!" when you take a temporarily vacated slot/stool (seat-saving
  with cups/jackets; reactions depend on the person), personal space on benches, laps (partner,
  kids), sharing couches/booths and scooting over.
- **Sitting/standing depends on your body**: drunk stumbles, slow grunting with age, injuries need
  crutches/help, post-meal groans, sore muscles after the gym. Sitting poses vary with personality
  and mood.

- **Sitting too long**: legs fall asleep (funny walk), back pain from bad chairs, stretching on
  standing.
- **Lie down anywhere** (beds, couches, park grass, beach, floor, car hoods under the stars;
  passing out counts).
- **Casino seat rules**: dealers ask non-players to play or move; slot hogging annoys staff and
  waiting players during busy times (depends on the person).
- **Dozing off while sitting** when tired: miss your bus stop, get robbed at slots, nod off in
  class — or while DRIVING (crash); warning signs are head bobs & slow blinks.

## 54. Owner's standing instructions (end of question phase, round 139)

- The question phase is over — **build the game now, and take time to make it perfect** (never
  rush, never ship something shallow).
- **Add realistic things on my own** even if the owner never mentioned them.
- **Space travel** (designed by me, realistic): real-world commercial space tourism for the very
  rich — apply, pass a medical check, train for days (g-force centrifuge, emergency drills), fly to
  the launch site in West Texas (suborbital capsule, ~11-minute flight, a few minutes of real
  weightlessness with floating physics & jiggle, view of the curved Earth, parachute landing) or pay
  far more for a private orbital mission. Bring a deck of cards and play a hand in zero-g with
  floating cards. Motion sickness depends on the person.

## 49. Content limits (hard rules)

- **No racial slurs and no racist insults** in any NPC, radio, TV, or generated dialogue. NPCs
  can still be rude, trash talk, swear (per the swear-filter setting) and fight — depending on
  the person — but never target race.
