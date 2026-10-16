# REAL LIFE: Master List

> **For the AI building this:** this is the full design for a browser game called REAL LIFE.
> Every answer here was picked by the player who wants the game, so follow it as written. Build it
> as a folder of files (section 38), first-person 3D with Three.js, keyboard + mouse on PC. Build
> the **[FIRST]** stuff first as an early playable, then the updates in order. "Yep that's on
> earth" means: make it work exactly like real life, with real-world details. The rules in
> section 0 are hard limits, don't change them.

Everything planned for REAL LIFE, in one place. It's a first-person 3D life sim. You get
born, grow up from a kid, and live a whole life: school, jobs, money, buying real stuff,
cars, houses, relationships, travel, crime, getting old. Everything depends on everything.
Nothing happens without a reason.

Tags used below:
- **[FIRST]** = in the first playable version
- **[LATER]** = comes in a later update
- **[SETTING]** = can be changed in Settings

---

## 0. The big rules

1. **Everything depends on everything.** No "50% chance" random stuff. People decide based on
   who they are, what they know and how they feel. Prices change for a reason. Mess has a cause.
2. **Real life first.** If it wouldn't work in real life, it doesn't work in the game
   (wrong PC part won't fit, a couch won't fit through a small door, no gas = car stops).
3. **Kids are protected.** No gore on kids ever: if a kid "dies" from something violent they get
   knocked out and wake up in the hospital instead. Kids can't buy guns or alcohol anywhere.
   No dating or romance with kids. Teens (13-17) only get crushes, holding hands and at most a
   quick innocent peck with another teen. Never anything between a teen and an adult.
4. **Romance stays off-screen.** Adults (18+ with 18+) can kiss and make out on screen with
   clothes on. Anything past that is a Sims-style fade to black + time skip. No sounds, nothing
   shown, no text describing it. No sexual content, no sexual websites, no jiggle physics on
   bodies. Never if either person is drunk. A "no" always ends it.
5. **Permadeath.** One life per save. When you die, it's over: funeral, life recap, new life.
6. **Parody brands only.** Everything real gets a parody name (see section 13).
7. **No lag.** Smart auto graphics keeps it smooth on a low-end GPU, with an Ultra preset for
   max looks (section 30).

---

## 1. Main menu + logo

- **Menu scene [FIRST]:** a kid's bedroom window at night. Rain running down the glass, a street
  light flickering outside, a car driving past with its headlights sweeping across the room, a
  dog barking somewhere. The camera breathes a tiny bit so it feels alive.
- **Logo [FIRST]:** "REAL LIFE" printed on a long store receipt that rolls out of a register
  printer with a little printer sound. Under the title: a barcode, a fake item list
  ("1x LIFE ... $0.00"), a total, and "THANK YOU FOR SHOPPING".
- **Buttons [FIRST]:** New Life / Load Life / Settings / Quit.
- **Load Life screen [FIRST]:** each save slot shows the person's name, age, money, country,
  in-game date, and a photo of them at their current age.

## 2. Starting a new life

- **Pick your family [FIRST]:**
  - Parents: two parents, single mom, single dad, grandparent(s), or random.
  - Each parent has a look, a job, a personality (strict / chill / doesn't care / overprotective
    / fun), and habits (one might smoke, drink, work too much).
  - Siblings: none, older, younger, twins, or random.
  - How rich: poor / working class / middle class / rich / very rich. This sets the house,
    neighborhood, allowance, the car your parents drive, and what's in the fridge.
  - House: apartment, small house, normal house, big house, mansion (based on money).
  - Family pet: none / dog / cat / fish / random.
- **Your look = your parents' genes [FIRST]:** your face, skin, hair, eye color, height and body
  type are mixed from the parents you picked. A few small tweak sliders on top. You can see what
  you'll roughly look like as a kid, teen and adult before you start.
- **Your name + birthday [FIRST].**
- **Starting country:** USA (hometown) for now. More start countries later. [LATER]

## 3. Birth + baby (the opening)

Skippable at any point.

1. **Birth cutscene [FIRST]:** hospital room, everything blurry and bright. Your eyes slowly
   open, doctors' voices muffled, your parents' faces leaning over you, soft music. Mom says
   your name.
2. **Playable baby [FIRST]:** a few minutes as a baby/toddler in the family house: crawl, grab
   stuff (put it in your mouth lol), cry to get attention (a parent comes over), knock things off
   tables, learn to stand and wobble your first steps. Parents react and pick you up.
3. **Growing-up flashes [FIRST]:** quick memory shots: first word, birthday cake with 1 candle,
   then 3, first day of kindergarten, losing a tooth.
4. **Wake up as a kid [FIRST]:** about 8 years old, in your bedroom on a Saturday morning. Mom or
   dad yells that breakfast is ready. Free play starts.

## 4. Time + growing up

- **Day length [FIRST]:** 24 real minutes = 1 in-game day (1 real minute = 1 game hour).
- **Sleeping skips time [FIRST]:** sleep in a bed and it fast-forwards to morning (needs still
  change while you sleep).
- **Aging by days [FIRST]:** 4 in-game days = 1 year (each day is about 3 months of life, one
  day per season). Kid (8) to adult (18) takes about 16 hours of play.
- **Life stages:** baby -> toddler -> kid (about 6-12) -> teen (13-17) -> young adult (18-25) ->
  adult (26-49) -> middle age (50-64) -> old (65+).
- **Your body grows [FIRST for kid, LATER for the rest]:** height, voice, face slowly change. Teens
  get acne and voice cracks lol. Adults can grow beards. Old age brings gray hair and wrinkles.
- **Birthdays [FIRST]:** cake, candles, a party if you have friends, money in cards from family.
- **Calendar:** days of the week (school Mon-Fri, weekends free), months, seasons, holidays.

## 5. Your body + needs

All needs show up as small icons only when they get low (full list on your phone).

- **Hunger [FIRST]:** eat or you get weak, then sick, then you can die. What you eat matters:
  junk food vs healthy food changes your weight, energy and health over time.
- **Thirst [FIRST]:** water, drinks. Heat makes you thirsty faster.
- **Sleep / energy [FIRST]:** tired = blurry screen, slow walking, bad at school/work. Pass out
  on the floor if you push too far.
- **Bathroom [FIRST]:** use the toilet. Wait too long and... yeah. Embarrassing.
- **Hygiene [FIRST]:** shower, brush teeth, deodorant. Stink = people react to you differently,
  dates go bad. Never brushing = cavities = dentist (section 6).
- **Mood [FIRST]:** happy, sad, bored, stressed, lonely, angry. Mood comes from what actually
  happens (good grades, fight with parents, new PC, breakup). Long sadness affects your body
  (sleep, appetite, energy).
- **Fun / social [FIRST]:** you get bored and lonely without fun and people.
- **Body over time:**
  - **Weight + metabolism [FIRST]:** from your parents' genes (some people stay skinny eating
    junk, some don't). Gain or lose weight from food + activity.
  - **Muscles + fitness [LATER]:** gym membership or home workouts (push-ups, weights you buy).
    Visible muscle. Stop and you slowly lose it. Fitness makes you faster, stronger in fights.
  - **Looks + style [LATER]:** barber/salon haircuts, beards, tattoos, piercings, glasses,
    clothes you buy.
  - **Bad habits [LATER]:** smoking (cough, lungs, yellow teeth), drinking too much (liver,
    hangovers), energy drinks (heart, sleep), no sleep. As a kid they hit even harder (kid finds
    a beer = throws up, feels sick, parents might find out).

## 6. Health, injuries + hospital

- **Getting sick [FIRST]:** colds, flu, food poisoning from expired food, stomach bugs from
  dirty hands. Sickness spreads from people near you (a sick classmate).
- **Injuries:** falls, sports injuries, car crashes, broken bones, cuts. Kids get bruises,
  scrapes and broken arms but never gore.
- **Gore + medical (adults only) [LATER]:** bullet wounds, stab wounds, cuts by weapon and
  body part, limbs coming off, bleeding out over time. Stitches, surgery, casts. Lose a leg =
  wheelchair or a prosthetic you buy. Scars stay forever. Gore slider in settings [SETTING].
- **Doctor + dentist [LATER]:** checkups, cavity fillings, braces as a kid (parents pay).
- **Hospital [LATER]:** ER with wait times, ambulance rides (expensive), surgeries, hospital
  stays. Kids who get "killed" violently wake up here instead.
- **Health insurance [LATER]:** through your job, bought yourself, or none. US bills can be
  thousands, the UK and Japan are way cheaper. Can't pay = medical debt that hurts your credit.
- **Pharmacy [LATER]:** prescriptions, cold medicine, bandages, pregnancy tests, protection.

## 7. Family + home life (as a kid)

- **Parents' rules [FIRST]:** bedtime, curfew, screen time, chores, homework before games.
  Strict parents check on you more, chill ones don't care. Rules loosen as you get older.
- **Getting in trouble [FIRST]:** sneak a cookie, stay up past bedtime gaming, skip chores,
  sneak out the window at night, take a beer from the garage fridge. Getting caught depends on
  who sees or hears you (a creaky stair, a sibling snitching). Punishments: yelled at, grounded
  (no phone, no going out), lose allowance, phone taken away.
- **Kid fun [FIRST]:** ride bikes, play at the park, build forts, video games, sleepovers at
  friends' houses, trick-or-treating, neighborhood kids to hang out with.
- **Family drama [LATER]:** parents fight, can get divorced (you pick who you live with), get
  sick, get old, die. Siblings fight with you, borrow your stuff, grow up and move out.
- **Moving out [LATER]:** you can stay home as an adult, but lazy grown-ups can get kicked out
  lol.

## 8. School

- **School day [FIRST outside / LATER inside]:** school bus or parents drive you. Classes as
  short minigames (math, science, reading, history, PE, art). Recess, lunch in the cafeteria
  (buy lunch or bring it), homework at home.
- **Grades + report cards [LATER]:** grades come from your homework, tests and showing up.
  Parents react to report cards (rewards or grounding).
- **People at school [LATER]:** friends, bullies, crushes (teens), teachers who like or hate you,
  the principal.
- **Skipping school [LATER]:** parents get a call, detention, grades drop.
- **School stages [LATER]:** elementary -> middle -> high school -> graduation -> college or trade
  school (costs money, student loans) -> unlocks better jobs.
- **Snow days [LATER]:** school closes in a big snowstorm.

## 9. Kid money

- **Allowance + chores [FIRST]:** trash, dishes, laundry, clean your room, mow the lawn, walk
  the dog. Paid weekly. Do them badly and you don't get paid.
- **Kid hustles [FIRST]:** lemonade stand (buy lemons and sugar at the grocery store, set a
  price), mow neighbors' lawns, shovel snow, wash cars, sell old toys and games.
- **Found + gifted money [FIRST]:** coins in the couch and on the ground, birthday cards from
  family, holiday money, the tooth fairy.
- **Other real kid money [LATER]:** recycling cans, pet-sitting, babysitting as a teen, selling
  stuff online with a parent's account, first part-time job at 15-16 (depends on the country).

## 10. Jobs, careers + business

- **Played jobs [LATER]:** you actually do the work in first person. Flip burgers, cashier,
  stock shelves, deliver pizza, drive a taxi or ride-share, fix cars, warehouse, construction,
  lifeguard, waiter. Show up on time, do it well, get paid. Mess up = written up = fired.
- **Applying [LATER]:** job listings online or a "now hiring" sign, an application, an interview
  (type-anything), age and record checks.
- **Career ladder [LATER]:** school and college unlock better jobs: nurse, doctor, engineer,
  programmer, lawyer, teacher, cop, pilot. Promotions, raises, bosses, coworkers.
- **Own business [LATER]:** food truck, shop, repair business, streaming/video channel, reselling
  stuff online. Start small, hire workers, grow into a real company.
- **Jobs per country [LATER]:** different jobs, pay and work ages in each country.
- **Retirement [LATER]:** retire when you're old, live on savings and retirement money.

## 11. Money + the bank

- **Cash [FIRST]:** real bills and coins in your wallet. Can be lost, dropped or stolen.
- **Bank account + debit card [LATER]:** kids get a kid account with a parent. ATMs, deposits.
- **Credit card + credit score [LATER]:** spend now, pay later with interest. Miss payments =
  score drops = no car loan, no apartment, no mortgage.
- **Loans [LATER]:** student loans, car loans, mortgages, payday loans (bad idea lol).
- **Paycheck + taxes [LATER]:** taxes taken out of your pay, a tax season.
- **Bills [LATER]:** rent/mortgage, power, water, internet, phone, insurance, subscriptions.
  Unpaid = late fees, then cut off.
- **Overdraft fees, savings interest [LATER].**
- **Stocks + crypto [LATER]:** buy and sell; prices move because of things that happen in the
  world (a company recall, a hype wave), not randomly.
- **Money in other countries [LATER]:** dollars, yen, pounds, euros, pesos, reais. Exchange
  rates and card fees when you travel.

## 12. Buying stuff (the core)

- **Walk-in stores [FIRST]:** real shelves full of products with price tags, aisles, carts
  and baskets, sale signs, out-of-stock gaps, store music and announcements. Pick stuff up, look
  at it, put it in your cart. Checkout at a register with a cashier or self-checkout. Pay cash
  (get change) or card. Bags, a real receipt you can keep. Carry the bags out (heavy = slower).
- **Sales tax [FIRST]:** shown at checkout, different by state and country.
- **Returns [LATER]:** bring it back with the receipt within the return window. Opened stuff might
  not be taken back.
- **Online shopping [LATER]:** order on your phone or PC. Delivery takes real in-game days.
  Packages can be late, dented, or stolen off your porch.
- **Used marketplace [LATER]:** buy used stuff from people (cheaper, haggle by typing). Can be
  broken, fake or a scam. Sell your own stuff too.
- **Prices [FIRST basic / LATER full]:** real-life prices, and they change for real reasons:
  sales, Black Friday, new GPU launch, shortages, inflation over the years.
- **Stock [FIRST]:** stores run out and restock on delivery days.
- **Scalpers [LATER]:** new consoles and GPUs sell out instantly, scalpers resell for double.
- **Age checks [FIRST]:** kids can't buy alcohol, cigarettes, guns, lottery tickets. The cashier
  asks for ID.

## 13. Parody brands

All brands are obvious parodies. Examples (the full list grows as stuff gets added):

| Real thing | Parody |
|---|---|
| GPUs | NVIDEO GeFarce RTX, Radeyon (ADM) |
| CPUs | Intol Core, ADM Ryzon |
| Phones | Pear iFone, Samsong Galaxie, Gugle Pixol |
| Consoles | PlayStashun 5, Xbocks Series Z, Nintendoh Swotch |
| Cars | Toyoda, Hondo, Furd, Chevrolay, Teslo, BMV, Mercedez-Benns, Lamborgeeni, Porshe |
| Fast food | McDanny's, Burger Kang, Wendee's, Taco Bel, Pizza Hutt, Dominose |
| Coffee | Starbux |
| Drinks | Pepsy, Koka-Kola, Mountain Doo, Red Ball, Monstar Energy, Gatorayd, Sprit |
| Snacks | Doritoz, Cheetoz, Leys, Pringels, Oreoz, Skitlez, Snikkers |
| Stores | Walmort, Targit, Best Bye, IKEO, Home Depo, CostKo, GameStopp, 7-Elevn |
| Websites | Amazan, YouTub, Netflicks, Instagran, TikTak, Redit, eBuy, Facebuk Marketplace |
| Banks | Chaise Bank, Wells Fargone |
| Dating app | Tindr |

## 14. Stores in the hometown

- **[FIRST]** Grocery store (Walmort-style supermarket), electronics store (Best Bye), furniture
  store (IKEO, with the showroom maze and warehouse aisles).
- **[LATER] Car + gas:** car dealer (new + used lot), gas station + snack shop, mechanic, car
  wash, auto parts store.
- **[LATER] Food:** McDanny's drive-thru, pizza place, diner, Starbux, fancy restaurant, food
  trucks.
- **[LATER] Everyday:** clothes store, shoe store, pharmacy, hardware store, pet store,
  barber/salon, gym, mall with a food court, GameStopp, bank, post office.
- **[LATER] Adults only:** gun store (background check where that's the law), liquor store (ID
  check, kids get kicked out), pawn shop, casino, bar/club (ID at the door), tattoo shop.

## 15. Product catalog

Starts with a few hundred items and keeps growing. Every item is a real 3D object you can
hold, use, break, sell, or throw away.

- **Groceries [FIRST]:** fruit, vegetables, bread, milk, eggs, cheese, meat, frozen pizza,
  cereal, chips, candy, soda, juice, water, coffee, spices, cooking stuff. Expiration dates.
- **Drinks [FIRST]:** soda, energy drinks, sports drinks, juice, milk, coffee, tea. Beer and
  liquor (adults only, kids have to "find" it).
- **Electronics [FIRST]:** TVs, consoles, controllers, games, phones, headphones, speakers,
  laptops, tablets, monitors, keyboards, mice, webcams, VR headset, smart watch.
- **PC parts [FIRST basic / LATER full]:** see section 16.
- **Furniture [FIRST]:** beds, desks, gaming chairs, couches, tables, dressers, shelves, lamps,
  rugs, TV stands, wardrobes, bean bags, bunk beds, mirrors, curtains.
- **Home stuff [LATER]:** kitchen appliances (microwave, air fryer, blender), vacuum, fans,
  heaters, smart lights, LED strips, posters, plants, wall art, stickers.
- **Clothes [LATER]:** shirts, hoodies, jeans, shorts, jackets, shoes and sneakers, hats,
  jewelry, watches, backpacks. Kid sizes vs adult sizes (you outgrow clothes).
- **Toys + kid stuff [FIRST]:** toy cars, action figures, board games, a bike, a skateboard,
  water guns, Nerf-style blasters.
- **Cars [LATER]:** see section 19.
- **Adult stuff [LATER]:** guns + ammo, alcohol, cigarettes, lottery tickets, protection.

## 16. PC building

"Yep that's on earth" level.

- **Buy parts [FIRST basic]:** CPU, GPU, RAM, motherboard, PSU, case, CPU cooler, case fans,
  SSD/HDD, thermal paste, cables, Wi-Fi card, monitor, keyboard, mouse.
- **Build by hand [LATER]:** on your desk, piece by piece: open the case, place the motherboard,
  seat the CPU, paste, cooler, RAM clicks in, GPU into the slot, plug in the power cables.
- **Real compatibility [LATER]:** the wrong socket won't fit, a GPU too long won't fit the case,
  a weak PSU makes the PC shut off under load, forget the power cable = no boot.
- **Install an OS [LATER]:** a parody "Windoze" install screen.
- **In-game games [LATER]:** download and play games on your PC. They run at FPS based on your
  in-game GPU and CPU (a cheap GPU = slideshow lol).
- **Real PC problems [LATER]:** dust builds up = heat = slower, so clean it. Parts can die
  (fans, an old HDD). Overclocking (risky). Viruses from shady downloads. Crypto mining with
  your GPU (pays a little, heats your room, raises the power bill).
- **Scalpers + launches [LATER]:** new GPUs sell out, scalpers double the price.

## 17. Furniture + your room

- **Comes in boxes [FIRST]:** store pickup or delivery. Big boxes are heavy: you walk slow, can
  drop them, and some need two people (a friend or family member helps) or a dolly.
- **Real fitting [FIRST]:** a couch too big won't fit through the door (pivot it lol), you can't
  place stuff inside other stuff.
- **Flat-pack building [LATER]:** IKEO stuff comes in pieces with screws and an instruction
  sheet. Build it piece by piece. Skip a step = it wobbles or breaks.
- **Placing [FIRST]:** pick up and place anywhere with real collisions, rotate it, stack small
  stuff on shelves.
- **Decorating [LATER]:** paint walls, change floors, hang posters, mount TVs, LED strips,
  rugs, curtains.
- **Quick build mode [SETTING][LATER]:** an optional Sims-style placement mode for fast
  decorating.

## 18. Housing (adults)

- **Move out when you want [LATER].**
- **Renting [LATER]:** apartment listings, viewings, application (credit check, income check),
  deposit, monthly rent, a landlord who fixes stuff (or doesn't), roommates who eat your food
  lol, eviction if you don't pay.
- **Buying a house [LATER]:** down payment + mortgage from the bank (needs a good credit score),
  property tax, home repairs, foreclosure if you can't pay.
- **Bills [LATER]:** power, water, internet (modem + router, Wi-Fi password, technician
  install), trash pickup.

## 19. Cars + driving

- **Kids driving [LATER]:** you can try lol. Cops pull you over, you crash, parents find out, big
  trouble.
- **License [LATER]:** driver's ed, a written test, a road test with an instructor who judges
  everything. Age depends on the country (16 US, 17 UK, 18 Japan/Mexico/Brazil).
- **Buying [LATER]:** new from the dealer (haggle by typing, sales guy pushes add-ons), used
  from the lot or the marketplace (scam sellers, hidden damage, rolled-back miles), car loans.
- **Owning [LATER]:** insurance (goes up after crashes), gas runs out, oil changes, tires wear
  and go flat, real damage (dents, broken windows, smashed lights), car wash, mechanic.
- **Breaking the law [LATER]:** speeding tickets, running red lights, impound, DUI (big trouble).
- **Driving feel [LATER]:** first person from the driver's seat, mirrors, radio, turn signals,
  wipers, headlights, horn. Wet or snowy roads make cars slide.

## 20. Travel + countries

- **Airport [LATER]:** buy a ticket (price depends on how far and how early you book),
  passport needed (apply at the post office, takes days), check-in, security (no guns or big
  liquids), gate, board and sit on the plane, land.
- **Each country is a detailed area [LATER]** with its own money, language on signs, stores,
  food, cars on the other side of the road where it's real, laws and prices:

| Country | City vibe | Money | Drinking age | Driving age | Guns |
|---|---|---|---|---|---|
| USA (home) | Suburb hometown + a big city | Dollars | 21 | 16 | Legal for adults with a background check (handguns 21+) |
| Japan | Tokyo-style: trains, vending machines, konbini | Yen | 20 | 18 | Basically illegal |
| UK + Europe | London-style: double-decker buses, pubs | Pounds / euros | 18 | 17 | Very strict |
| Mexico | Warm city, beach, street food | Pesos | 18 | 18 | Very restricted |
| Brazil | Big city + beach | Reais | 18 | 18 | Restricted |

- **Nearby cities [LATER]:** drive, take a bus, or take a train to the big US city.
- **Hotels [LATER]:** book a room, check in, leave stuff in your room.

## 21. Laws, crime + police

- **Laws per place [LATER]:** the table above, plus local stuff (open-container laws, jaywalking
  in some places, curfews for kids).
- **Crimes [LATER]:** stealing from stores, shoplifting, breaking into cars or houses, fighting,
  vandalism, drunk driving, carrying illegal guns, dealing with the black market, hit-and-run,
  murder.
- **Witnesses decide [LATER]:** people only call the cops if they saw or heard something, and
  whether they call depends on who they are (some snitch, some mind their business, some film it
  for social media). Cameras in stores catch you.
- **Police [LATER]:** they show up based on 911 calls, investigate, ask questions, chase you,
  arrest you.
- **Court [LATER]:** bail, a lawyer (public defender or pay for a good one), court date,
  judge/jury, fines, community service, probation, or jail time based on the crime and
  evidence.
- **Black market [LATER]:** dark web (needs a special browser), shady people in alleys. Cheaper
  or illegal stuff, but you can get scammed, sold fakes, or set up by undercover cops, and
  police can track you.
- **Kids + crime [LATER]:** juvie instead of jail, parents get called, way lighter.

## 22. Jail (adults)

- **Daily routine [LATER]:** wake-up count, cafeteria meals, yard time, a prison job for tiny
  pay, lights out. Time inside can be sped up.
- **People [LATER]:** a cellmate with his own personality, gangs, guards, fights, friends and
  enemies, the commissary (buy snacks, soap, ramen with prison money).
- **Visitors [LATER]:** family and your partner can visit (or stop visiting...).
- **Getting out [LATER]:** serve your time, good behavior = early parole, lawyer appeal. After:
  a criminal record makes jobs and apartments harder.
- **Escape [LATER]:** dig, sneak, bribe. Caught = more time. Out = wanted fugitive.

## 23. Fighting, weapons + gore

- **Kids [LATER]:** school fights, shoving, punches. Bruises, crying, detention. No gore ever.
- **Fists + kicks (all ages) [LATER]:** punch, kick, block, grab, shove. Black eyes, bloody nose
  (adults), knocked out. Stronger and fitter = hits harder.
- **Melee weapons (adults) [LATER]:** knives, bats, crowbars, machetes, kitchen stuff, anything
  you can pick up. Wounds depend on the weapon and where it hits.
- **Guns (adults) [LATER]:** recoil, reloading, bullet drop, really loud (people call 911).
  Bought legally where allowed, or off the black market.
- **NPCs fight like who they are [LATER]:** a cop fights smart, a scared person runs, a big guy
  hits hard, a gang member pulls a weapon.
- **Gore (adults only) [LATER]:** see section 6. Gore slider [SETTING].

## 24. People (NPCs)

"Yep that's on earth" level.

- **Everyone has a real life [FIRST]:** name, age, home, job or school, daily schedule (wake up,
  commute, work, lunch, shop, gym, home, sleep), personality traits, likes and hates, friends,
  family.
- **They remember you [FIRST]:** what you said, what you did, whether you were nice, rude,
  stole from them, helped them. They tell other people.
- **Off-screen life [LATER]:** people you're not near keep living (simplified), so when you come
  back things have changed (someone moved, got fired, had a baby, died).
- **They age [LATER]:** your classmates grow up with you, neighbors get old.
- **Reactions [FIRST]:** people react to how you look, smell, what you're holding, what you're
  doing (pull out a knife in the store = panic).

## 25. Talking

- **Type anything [FIRST]:** walk up, press E, type whatever you want. They answer with real
  words based on their personality, mood, what they know, and what they think of you. Cussing
  depends on the person.
- **AI brain [SETTING][FIRST]:**
  - Built-in brain (default, offline, no setup, uses personality + mood + memory).
  - Free local AI download option for smarter replies.
  - Your own Claude API key option for the smartest replies (with a daily spending limit).
- **Subtitles [SETTING].** Voices: babble or spoken (browser voices) [SETTING].

## 26. Relationships + romance

Everything here is "yep that's on earth". The other person always decides for themselves.

- **Friends + enemies [FIRST basic]:** friendship grows by hanging out, helping, gifts, and falls
  apart from lying, ignoring, stealing. Bullies, rivals, enemies.
- **Who likes who [LATER]:** every NPC has their own orientation (straight, gay, bi), their own
  type and deal-breakers. You pick yours. Some people won't be into you no matter what.
- **Attraction [LATER]:** every NPC likes different things: looks, fitness, money, job, humor,
  kindness, style, car, their own taste. Not everyone will like you.
- **Meeting people [LATER]:** everywhere real: school, college, work, gym, coffee shop, through
  friends, neighbors, the dating app, church, hobbies and clubs, a wrong-number text, bumping into
  someone. Bars and clubs too (section 26b).
- **Teens (13-17) [LATER]:** crushes, holding hands, passing notes, texting, school dances, friends
  teasing you, strict parents finding out. A first kiss between two teens of the same age group
  only: a quick innocent peck, the camera cuts away, both get a "First Kiss" memory. They have
  to like you first and can say no or get embarrassed. Nothing more than that, and never with an
  adult.
- **Flirting (adults) [LATER]:** type-anything flirting. They react by personality: some love
  cheesy lines, some think you're weird. Creepy = bad reputation.
- **Texting [LATER]:** type anything, they reply by personality + mood. Left on read,
  double-texting looks desperate, the "typing..." bubble that stops, good-morning texts, pet
  names, emojis. If they like you they text first.
- **Dating app [LATER]:** Tindr on your phone: swipe, match, chat, ghosted, catfished, meet up.
- **Dates [LATER]:** restaurant, movie theater, park walk, beach, arcade, fair, coffee, cook at
  home. What matters: your outfit, hygiene, being on time, who pays, what you talk about, your
  car. Gifts: flowers, chocolate, jewelry, stuffed animals, or something they hinted they wanted.
- **Kissing (adults 18+) [LATER]:** real animation, both lean in and react after. The other
  person decides. Types: peck, hug + kiss, date kiss, goodbye kiss, wedding kiss. People who see
  it remember it.
- **Making out (adults 18+ with 18+ only) [LATER]:** a longer kiss animation, clothes stay on,
  normal camera, PG-13 movie level. Either one can start or stop it. In public people stare or
  comment, at work you can get in trouble with your boss. If you're cheating and someone sees,
  word gets back to your partner.
- **Your partner starts things too [LATER]:** they can kiss you first (more when the relationship
  and mood are high, after a good date or a gift; a shy partner rarely does, a flirty one does a
  lot). You kiss back or turn away (turning away makes them sad/awkward, worse if it keeps
  happening).
- **Off-screen time (adults) [LATER]:** either of you can ask, in a normal non-explicit way
  ("wanna head to bed?"). The answer is Yes or Not tonight, decided by mood, energy, sickness,
  stress, a fight earlier that day, and how things are between you. Saying no now and then is
  fine. Never happens if either person is drunk or wasted (the other says "you're drunk, let's
  just sleep"). If yes: walk to the bedroom holding hands, door closes, lights click off, fade to
  black. Next morning: wake up next to each other, "Loved" mood, relationship up, breakfast
  together. Pharmacy protection lowers the pregnancy chance. Pregnancy test, telling the family.
  That's the whole thing, nothing more gets added to it.
- **Asking your partner for things [LATER]:** type ANY request ("make dinner", "come to the
  store with me", "stop texting your ex", "get a job", "move to Japan with me"). They understand
  it and answer yes / no / maybe / a counter-offer based on their personality, mood, how much
  they love you, how fair the ask is, how you asked (bossy annoys them, nice works better) and
  your history (always asking and never giving back = more no's). Big asks start a real
  conversation. They ask YOU for things too, and ignoring them causes drama.
- **Their family [LATER]:** dinner with their family, parents like or hate you (job, manners,
  looks, car), the overprotective dad, splitting holidays between families, in-laws visiting,
  family pressure to marry or have kids.
- **Living together [LATER]:** move in (your place, theirs, or a new one), split rent and bills,
  fights about chores, dishes and mess, sharing the bed (they steal the blanket), merging
  furniture, cooking for each other, habits that are annoying or cute.
- **Dates to remember [LATER]:** they remember anniversaries, birthdays and Valentine's.
  Forgetting = a big fight. Gifts matter (they hint what they want), surprise parties,
  Valentine's dinner reservations sell out, flowers, cards, jewelry.
- **Drama [LATER]:** jealousy (texting someone else too much), cheating found out through texts
  or witnesses, getting cheated on, fights about money/chores/time, exes texting you.
- **Proposals + weddings [LATER]:** pick the ring (cheap vs huge diamond), the place and the
  moment. They can say no, even in public. Plan the wedding: venue, guest list, dress/suit, cake,
  DJ, budget, family drama. Type your own vows. A real ceremony, reception and dancing, then a
  honeymoon trip.
- **Breakups [LATER]:** over text, in person, or they dump you. Sad for days (eating junk, can't
  sleep, bad at work), longer relationship = worse heartbreak. Move out, split your stuff, mutual
  friends pick sides, seeing them with someone new, sometimes getting back together.
- **Divorce [LATER]:** splits money and the house, a custody court, child support.
- **Your own kids [LATER]:** talk about wanting kids first (they might not want any). Pregnancy
  takes months with checkups and cravings, birth at the hospital, or adoption. Babies cry at
  night, need diapers and formula, daycare costs money. Kids get traits and looks from both
  parents and grow up with their own personalities. When you die you can keep playing as your
  kid.

## 26b. Drinking, parties + nightlife (adults only)

Legal drinking age depends on the country (section 20). Kids who find beer just get sick and
in trouble (section 7).

- **Where to drink [LATER]:** bars, clubs, house parties, restaurants, liquor store, the fridge
  at home. ID checks everywhere, fake IDs can get caught. Happy hour prices, last call, bouncers,
  the bartender cutting you off, running a tab, tipping, BYOB parties.
- **How drunk you get [LATER]:** tipsy -> drunk -> wasted, based on how much you drink, your body
  weight and whether you ate. Tipsy = chattier, a bit more confident. Drunk = slurred texts,
  wobbly walking. Wasted = throwing up, passing out.
- **Drunk effects on screen [LATER]:** stronger the drunker you are. Tipsy = slight sway. Drunk =
  blur, double vision, delayed mouse. Wasted = spinning screen, stumbling, falling over.
- **Drunk flirting [LATER]:** depends on the NPC. Some think drunk you is fun, some are turned off
  right away. A drunk kiss at a party is two people being sloppy and awkward, never one person
  taking advantage of the other.
- **Parties [LATER]:** house parties with music and crowds, beer pong, flip cup, someone puking in
  the bathroom, neighbors calling the cops about the noise, the party getting busted.
- **Bars + clubs [LATER]:** buy someone a drink, dance floor, get numbers, get rejected, a
  wingman friend helps, bouncers kick out messy drunks, people lying about being single.
- **Getting home [LATER]:** ride-share app, taxi, a sober friend drives, walk home, crash on a
  couch. Drunk driving = swerving controls, cops, DUI, license taken away, crashes, jail.
- **Drunk drama [LATER]:** drunk texting or calling your ex, bar fights, crying at parties,
  telling secrets, saying the wrong thing to your partner, getting kicked out, losing your phone
  or wallet. Plus the funny stuff: bad dancing, karaoke, falling asleep in weird places.
- **The next morning [LATER]:** blackout gaps if you got wasted (you find out what happened from
  texts, photos on social media, friends telling you), embarrassing posts going viral, people
  remembering what you did, apologizing to fix it.
- **Hangovers [LATER]:** headache, light hurts your eyes, nausea, low energy, late for work or
  school. Water, greasy food, sleep and pharmacy pills help. Worse as you get older.
- **Your partner + drinking [LATER]:** depends on them: some party with you, some hate it.
  Drinking too often becomes a real addiction: fights, breakups, your family worried, rehab, AA
  meetings.

## 26c. Breaking stuff

All "yep that's on earth".

- **What breaks [FIRST basic / LATER full]:** everything that breaks in real life: glass,
  plates, TVs, phones, furniture, walls (holes in drywall), car windows, PC parts. Things break
  based on what they're made of and how hard they get hit.
- **How it looks [FIRST]:** real pieces by material: glass shards, wood splinters, phone screen
  cracks that spread, a TV screen spiderweb. Pieces bounce and fall with physics.
- **After it breaks [LATER]:** broken pieces stay until someone cleans them up. You can step on
  glass and get cut. Pay to fix or replace it, repair shops, insurance claims. Parents get mad if
  you're a kid, the landlord keeps your deposit, breaking someone else's stuff = police or paying
  them back.
- **Wearing out [LATER]:** stuff ages on its own: phone batteries get weak, shoes wear out, the
  couch sags, the fridge breaks, the water heater leaks, car parts fail, PC fans die. Cheap stuff
  breaks faster than good stuff.
- **Breaking stuff when mad [LATER]:** punch a wall (hurts your hand, leaves a hole), throw your
  controller, smash your phone. Rage rooms you can pay to visit. It costs money, can hurt you,
  and people react.
- **Fixing it yourself [LATER]:** repair skill. Watch how-to videos on the in-game video site, buy
  parts and tools, fix it by hand (replace a phone screen, patch drywall, fix a leak). Mess up =
  it gets worse. Or pay a pro.

## 27. Your phone

You might not have one as a kid until your parents buy one or you buy it yourself.

- **[FIRST]** Clock + date, needs, money, map, contacts.
- **Texting + calls [LATER]:** people text you on their own, group chats, cussing, spam calls,
  scam texts.
- **Apps [LATER]:** shopping, bank, food delivery, ride-share, maps/GPS, camera + photo
  gallery, music player (load your own MP3s), weather, alarm, games, social media (post pics and
  videos, likes, followers, going viral or getting hated), Tindr.
- **Real phone problems [LATER]:** battery dies, screen cracks when dropped, phone stolen, data
  plan runs out, bill unpaid = cut off.

## 28. In-game internet

All parody sites, on the PC and phone. [LATER] unless noted. The internet works like it does in
real life, and you pay for it.

- **Getting internet:** pick a made-up internet company and a plan (speed vs price). A
  technician installs the modem + router, or you set it up yourself. Monthly bill, cut off if
  unpaid, outages happen. As a kid your family has it; as an adult you sign up yourself.
- **Wi-Fi:** range depends on rooms and walls (weak in the basement), passwords, neighbors
  stealing your Wi-Fi, speed slows when the family is streaming, an ethernet cable is faster,
  rebooting the router fixes things, public Wi-Fi at cafes.
- **Phone data:** made-up phone carriers with data limits, slow after the limit, overage fees,
  dead zones, roaming costs extra abroad, kids on their parents' plan.
- **The browser:** a real-looking browser on the PC and phone: tabs, address bar, typing site
  names, a parody search engine, bookmarks, history, ads, pop-ups.
- **Making your own stuff:** post on social media, record and upload videos, start a channel, go
  viral or flop, earn money from views and sponsors, sell on the marketplace, make your own
  website or online store.
- **Dangers:** scam sites, phishing texts and emails, hacked accounts, stolen card numbers,
  viruses, catfishing, cyberbullying as a kid, strangers online (kids get safety warnings).
- **Kid rules:** depend on your family. Strict parents = parental controls, screen time limits,
  phone taken at night, checking your texts. Chill parents = more freedom. Getting around the
  rules and getting caught = grounded.
- **First playable [FIRST]:** home Wi-Fi + the phone browser + a shopping site + a bank app. The
  rest comes in updates.
- **Shopping + selling:** Amazan, PC part stores, car sites, eBuy, Facebuk Marketplace.
- **Dark web:** special browser, sketchy shops, scams, police can track you.
- **Video + social:** YouTub (made-up videos), Instagran, TikTak, forums where people argue,
  a town news site that reports stuff that actually happened in your game.
- **Life stuff:** job listings, bank site, school portal with your grades, apartment and house
  listings, flight booking, maps.
- **Games + downloads:** download in-game games (FPS by your GPU), free downloads that might
  give you a virus, scam sites ("free gift card!!") that steal your money.

## 29. TV, movies + music

- **TV [FIRST basic / LATER full]:** channels with made-up shows playing in real time: town news
  (real events), kids' cartoons, sports, game shows, cooking shows, ads.
- **Streaming [LATER]:** Netflicks and YouTub-style apps with monthly subs, made-up movies and
  series, password sharing with family.
- **Movie theater [LATER]:** tickets, popcorn, drinks, a made-up movie, a great date spot.
- **Watching with people [LATER]:** family in the living room, fighting over the remote, movie
  night with friends.
- **Music [FIRST]:** car radio stations, phone music app, speakers you buy, TV music, your own
  MP3s.

## 30. Sound

- **Real-life sounds [FIRST]:** footsteps that change by floor (wood, carpet, tile, grass,
  puddles), doors, fridge hum, store beeps and announcements, cash register, shopping cart
  rattle, cars, birds, wind, rain, thunder, people chatting around you, a TV in another room.
- **Background music [SETTING][FIRST]:** chill music that changes by place (home, store, night,
  city), with an off switch.
- **Volume sliders [FIRST]:** master, music, sounds, voices, radio.

## 31. Graphics + performance

- **Smart AUTO [FIRST]:** watches FPS and picks the best look that stays smooth.
- **Presets [FIRST]:** Low / Medium / High / Ultra (everything on, even if it lags).
- **Toggles [FIRST]:** shadows, grass, reflections, draw distance, people count, car count,
  resolution scale.
- **FPS counter [SETTING][FIRST].**
- **Tricks to stay smooth:** far-away people are simple, rooms you're not in stop drawing,
  stuff far away uses low-detail versions.

## 32. Controls + HUD

- **PC: keyboard + mouse [FIRST]**, all keys rebindable [SETTING]:
  - WASD move, mouse look, Shift sprint, Ctrl crouch, Space jump
  - E interact / talk, left click use/grab, right click aim/inspect, R drop
  - Tab phone, Esc pause, I inventory, 1-9 quick items
- **Clean HUD [FIRST]:** just a small dot crosshair, a hint when you look at something
  ("E - Pick up Pepsy 12-pack $6.99"), and small need icons only when a need gets low.
  Everything else lives on the phone.
- **Hands [FIRST]:** you see your hands holding stuff. Holding two things (phone in one hand,
  something in the other) never glitches the items together.

## 33. Weather, seasons + holidays

- **Weather [FIRST basic]:** sun, clouds, rain, storms, fog, snow, heat waves. It changes stuff:
  wet roads, snow days, heat = thirst, cold = need a jacket.
- **4 seasons [LATER]:** spring, summer (summer break), fall (leaves change and fall), winter
  (snow piles up).
- **Holidays [LATER]:** Halloween (costumes, trick-or-treating as a kid, candy), Thanksgiving
  (family dinner), Christmas (decorations, presents, tree), New Year (fireworks), July 4th
  (fireworks, BBQ), Valentine's, your birthday. Other countries get their own holidays.

## 34. Pets

- **[LATER]** Buy or adopt: dog, cat, fish, hamster, bird, lizard, snake. The family might already
  have one when you start.
- **Real care [LATER]:** food, water, walks, litter box, cleaning the tank, vet visits that cost
  money, shots, getting sick, getting old, dying, running away if the gate is left open.
- **Personality [LATER]:** a dog that loves you, a cat that ignores you, a dog that barks at the
  mail guy.

## 35. Death + old age

- **Ways to die (adults):** violence, car crashes, sickness, not eating/drinking, bad habits
  catching up, old age. Kids get knocked out instead of dying from violence.
- **Old age [LATER]:** when you die of old age depends on your health (diet, fitness, habits,
  injuries). Healthy people can live to 90+.
- **Funeral + life recap [LATER]:** your funeral (who shows up depends on your relationships),
  then a recap: how long you lived, money, stuff you owned, jobs, people you loved, crimes, a
  photo timeline from baby to the end. Then a new life.

## 36. Saving

- **Auto-save [FIRST]:** every few minutes and when you sleep. Only ONE save per life, so you
  can't reload to undo dying.
- **Life slots [FIRST]:** several different lives saved at once.
- **Backup [FIRST]:** download and upload your save file.

## 37. Settings list

Graphics (AUTO / presets / toggles / FPS counter), gore slider, AI brain (built-in / local /
API key + spending limit), subtitles, voices, background music on/off, volume sliders, key
rebinding, mouse sensitivity, FOV, quick build mode, HUD hints on/off, camera bob on/off.

---

## 38. Build plan

### First playable

1. Main menu (bedroom window + receipt logo), new life screen (family + genes look), life slots.
2. Birth cutscene -> playable baby -> growing-up flashes -> wake up as a kid.
3. The family house, super detailed: every room furnished, drawers, cabinets and fridge you can
   open, stuff to pick up, your bedroom to fill with stuff you buy.
4. The neighborhood: your street, neighbors' houses, sidewalks, cars driving, a park, the school
   building from outside, day/night, weather.
5. Three stores: grocery, electronics, furniture, with real shelves, carts, checkout, bags,
   receipts, prices, stock, age checks.
6. Kid life: needs, chores + allowance, lemonade stand, found money, parents' rules,
   getting caught.
7. People: family + neighbors + store workers with schedules, memory and type-anything talking
   (built-in brain + optional local AI / API key).
8. Phone basics, TV basics, radio/music, real sounds, graphics settings, saving.

### Updates after that (rough order)

1. School inside + grades + friends/bullies + growing into a teen.
2. More stores + food places + bank + money system.
3. Turning 16+: license, cars, part-time jobs, PC building by hand.
4. Adulthood: moving out, renting, jobs + career ladder, dating + romance, bills.
5. The big city + crime, police, court, jail, black market, fighting, guns, gore + hospital.
6. Airports + countries (Japan, UK/Europe, Mexico, Brazil).
7. Marriage, kids, family drama, pets, holidays + seasons.
8. Old age, retirement, death, funeral + life recap.

### Files

A folder of files (`real-life/`):
- `index.html`: the page that loads everything
- `js/` split by part: `engine`, `world`, `house`, `stores`, `products`, `people`, `talk`,
  `phone`, `money`, `needs`, `time`, `ui`, `audio`, `save`, and more as updates come in
- `vendor/`: Three.js, stored locally like the other games in this repo

---

## Decided after the list

1. **Aging speed:** 4 in-game days = 1 year. Kid (8) to adult (18) in about 16 hours of play.
   Each day = one season of that year (spring, summer, fall, winter).
2. **Hometown:** Maple Hollow, Ohio, a Midwest suburb. Real 4 seasons with snowy winters and
   fall leaves, Ohio sales tax (5.75% state + local), cheaper prices than the coasts.
3. **First neighborhood size:** one street first (about 10 houses, a few you can go inside, the
   park at the end, and a small shopping plaza with the 3 stores). It grows to a few blocks
   (3-4 streets, about 30 houses, the school, a bigger shopping area) in an update.
