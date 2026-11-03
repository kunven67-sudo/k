// SPINBORN wheel data: the main stat wheels.
// Slice = [label, weight, what it does]. Weight = slice size (bigger = more likely).
// Tier wheels are ordered weakest -> strongest; the index is the tier the game uses later (people, fights).

export const STRENGTH_TIERS = [
  ['Weak', 0.6, 'Weaker than a normal person. Opening a jar is a fight.'],
  ['Average', 1.4, 'Normal human strength. You can carry groceries.'],
  ['Above average', 2.4, 'Gym-rat strong. You win most arm wrestles.'],
  ['Street Level', 4.4, 'Strong enough to beat up a gang with your fists.'],
  ['Wall Level', 5.2, 'Your punches smash through brick walls.'],
  ['Building Level', 5.6, 'One hit can knock down a whole building.'],
  ['City Level', 5.8, 'You can wipe out a city with your power.'],
  ['Mountain Level', 5.6, 'You can flatten a mountain.'],
  ['Island Level', 5.4, 'You can sink an island into the sea.'],
  ['Country Level', 5.2, 'You can destroy a whole country.'],
  ['Continent Level', 4.8, 'You can break an entire continent.'],
  ['Moon Level', 4.0, 'You can shatter a moon.'],
  ['Planetary', 3.6, 'You can blow up a planet.'],
  ['Star Level', 3.0, 'You can destroy a star like the sun.'],
  ['Solar System Level', 2.4, 'You can wipe out a whole solar system.'],
  ['Galaxy Level', 2.0, 'You can destroy a galaxy with billions of stars.'],
  ['Universal', 1.5, 'You can destroy the entire universe.'],
  ['Multiversal', 1.1, 'You can destroy many universes at once.'],
  ['Hyperversal', 0.7, 'Beyond the multiverse. Higher dimensions break under you.'],
  ['Boundless', 0.4, 'No limit at all. Nothing can measure your strength.']
];

export const DURABILITY_TIERS = [
  ['Weak', 0.6, 'You get hurt by almost anything. Be careful.'],
  ['Average', 1.4, 'Normal human body. Bullets and falls are bad news.'],
  ['Above Average', 2.4, 'Tough. You can take a beating and keep going.'],
  ['Street Level', 4.4, 'You can tank punches, bats and knives.'],
  ['Wall Level', 5.2, 'Getting thrown through a wall barely hurts.'],
  ['Building Level', 5.6, 'A building falling on you won\'t keep you down.'],
  ['City Level', 5.8, 'You survive attacks that would destroy a city.'],
  ['Mountain Level', 5.6, 'A mountain-destroying hit won\'t kill you.'],
  ['Island Level', 5.4, 'You can tank island-sinking attacks.'],
  ['Country Level', 5.2, 'You survive country-ending attacks.'],
  ['Continent Level', 4.8, 'You survive attacks that break continents.'],
  ['Moon Level', 4.0, 'You survive a moon being shattered on you.'],
  ['Planetary', 3.6, 'You survive a planet blowing up.'],
  ['Star Level', 3.0, 'You can tank a star exploding.'],
  ['Solar System Level', 2.4, 'You survive a whole solar system being destroyed.'],
  ['Galaxy Level', 2.0, 'You survive a galaxy being wiped out.'],
  ['Universal', 1.5, 'You survive the universe ending.'],
  ['Multiversal', 1.1, 'You survive many universes ending.'],
  ['Hyperversal', 0.7, 'Higher-dimension attacks can\'t kill you.'],
  ['Boundless', 0.4, 'Nothing can ever hurt you. Unkillable.']
];

export const SPEED_TIERS = [
  ['Weak', 0.6, 'Slower than a normal person. Everyone passes you.'],
  ['Walking', 2.4, 'Normal walking speed. That\'s it.'],
  ['Running', 3.6, 'You can run like a normal fit person.'],
  ['Athletic human', 5.2, 'Olympic sprinter speed.'],
  ['Subsonic', 6.6, 'Faster than a race car, just under the speed of sound.'],
  ['Transonic', 6.2, 'Right at the speed of sound. Things start to blur.'],
  ['Supersonic', 6.4, 'Faster than sound. You make a sonic boom when you run.'],
  ['Hypersonic', 6.0, 'Five times faster than sound. Bullets look slow.'],
  ['Relativistic', 5.2, 'A big chunk of the speed of light. Time gets weird.'],
  ['Light Speed', 4.4, 'As fast as light. You can circle the Earth 7 times a second.'],
  ['FTL', 3.6, 'Faster than light. You reach other stars in moments.'],
  ['Infinite Speed', 1.6, 'You get anywhere instantly. Speed has no meaning.'],
  ['Immeasurable Speed', 1.0, 'Beyond time and space. Nobody can measure it.'],
  ['Omnipresent', 0.6, 'You are everywhere at once.'],
  ['Boundless Speed', 0.4, 'No limit. Faster than every concept of speed.']
];

export const IQ_TIERS = [
  ['Animal IQ', 1.2, 'You think like an animal. Instinct only.'],
  ['Dumb IQ', 3.2, 'Not the brightest. Doors marked "pull" beat you.'],
  ['Low IQ', 4.6, 'A bit slow, but you get there in the end.'],
  ['Average IQ', 6.8, 'Normal smart. You figure most things out.'],
  ['High IQ', 6.2, 'Smart. You learn fast and plan ahead.'],
  ['Genius IQ', 5.2, 'Genius. You invent things and outsmart people.'],
  ['Super Genius IQ', 3.6, 'Way past genius. You see ten moves ahead.'],
  ['Cosmic IQ', 2.2, 'You understand how the universe works.'],
  ['Nigh-Omniscient IQ', 1.0, 'You know almost everything that exists.'],
  ['Omniscient IQ', 0.5, 'You know EVERYTHING. Past, present and future.']
];

export const FIGHTING_TIERS = [
  ['Weak', 0.8, 'You don\'t know how to fight at all.'],
  ['Beginner', 2.6, 'You know how to throw a punch. Barely.'],
  ['Average', 4.0, 'You can handle yourself in a normal fight.'],
  ['Skilled', 5.2, 'Trained fighter. You know combos and blocks.'],
  ['Expert', 6.0, 'Expert. You read your enemy and counter them.'],
  ['Elite', 5.2, 'Elite. One of the best fighters alive.'],
  ['Master', 4.0, 'Master. You could teach armies how to fight.'],
  ['Grandmaster', 2.6, 'Grandmaster. Your moves look like art.'],
  ['Unmatched', 1.4, 'Nobody can match your skill. Ever.'],
  ['Godlike', 0.7, 'Fighting skill of a god. Every move is perfect.']
];

export const WEAPON_MASTERY = [
  ['Beginner', 1.0, 'You just picked it up. You might hurt yourself.'],
  ['Amateur', 2.6, 'You know which end to hold.'],
  ['Average', 4.0, 'You use it okay in a fight.'],
  ['Skilled', 5.2, 'You use it well. It makes you way more dangerous.'],
  ['Expert', 5.6, 'Expert. Your weapon moves like part of your body.'],
  ['Elite', 4.6, 'Elite. You can beat armies with it.'],
  ['Master', 3.4, 'Master. You unlock its hidden powers.'],
  ['Grandmaster', 2.2, 'Grandmaster. Your weapon technique is legendary.'],
  ['Legendary', 1.2, 'Legendary. Stories will be told about you and this weapon.'],
  ['Perfect Mastery', 0.5, 'Perfect. You use 100% of what the weapon can do.']
];

export const POWER_MASTERY = [
  ['Weak Control', 1.0, 'Your power goes off by itself. It\'s barely useful.'],
  ['Beginner', 2.6, 'You can use your power a little.'],
  ['Average', 4.0, 'You control your power okay.'],
  ['Skilled', 5.2, 'Good control. You use it in smart ways.'],
  ['Expert', 5.6, 'Expert. Your power is strong and precise.'],
  ['Elite', 4.6, 'Elite. You do things with it others can\'t.'],
  ['Master', 3.4, 'Master. You unlock new tricks of your power.'],
  ['Grandmaster', 2.2, 'Grandmaster. Your power is at a scary level.'],
  ['Legendary', 1.2, 'Legendary. Your power reshapes the world.'],
  ['Absolute Mastery', 0.5, 'Absolute. 100% of your power, any way you want.']
];

export const AGES = [
  ['Young (0–20)', 7, 'A kid or teen. Your whole life ahead of you.', [16, 20]],
  ['Adult (21–40)', 7, 'Grown up and in your prime.', [21, 40]],
  ['Middle Aged (41–60)', 6, 'Experienced. You have seen some things.', [41, 60]],
  ['Senior (61–100)', 6, 'Old but wise. Careful with your back.', [61, 100]],
  ['Centuries Old', 6, 'You lived for hundreds of years.', [100, 999]],
  ['Millennia Old', 6, 'You lived for thousands of years.', [1000, 9999]],
  ['Ancient', 6, 'Older than most kingdoms.', [10000, 99999]],
  ['Prehistoric', 5, 'You were around with the dinosaurs.', [100000, 66000000]],
  ['Millions of Years Old', 5, 'You lived for millions of years.', [1000000, 999000000]],
  ['Billions of Years Old', 4, 'You lived for billions of years.', [1000000000, 4000000000]],
  ['Older Than Civilization', 4, 'You were here before the first city was built.', [12000, 99000]],
  ['Older Than Earth', 4, 'You existed before Earth was formed.', [4600000000, 5000000000]],
  ['Older Than the Solar System', 3, 'Before the sun was even born.', [5000000000, 9000000000]],
  ['Older Than the Galaxy', 3, 'Before the Milky Way formed.', [9000000000, 13000000000]],
  ['Older Than the Universe', 2, 'You were here before everything began.', [13800000000, 99999999999]]
];

// 1'0" .. 9'11" every inch, equal slices like the video.
export const HEIGHTS = (() => {
  const out = [];
  for (let i = 12; i <= 119; i++) {
    const ft = Math.floor(i / 12), inch = i % 12;
    let d;
    if (i < 36) d = 'Tiny. Most people tower over you.';
    else if (i < 60) d = 'Short. Easy to miss in a crowd.';
    else if (i < 72) d = 'Normal height.';
    else if (i < 84) d = 'Tall. You stand out everywhere.';
    else if (i < 96) d = 'Huge. You duck under every door.';
    else d = 'A giant. People look up at you like a titan.';
    out.push([`${ft}'${inch}"`, 1, d, i]);
  }
  return out;
})();

export const LUCK = [
  ['Cursed Luck', 1.5, 'Everything goes wrong. Good slices get smaller for you.', -0.7],
  ['Unlucky', 3.5, 'Bad luck follows you. Odds are a bit worse.', -0.35],
  ['Normal Luck', 6, 'Normal luck. The wheels are fair.', 0],
  ['Lucky', 4, 'Lucky. Good slices get a bit bigger for you.', 0.3],
  ['Very Lucky', 2.2, 'Very lucky. Great results come way more often.', 0.55],
  ['Blessed', 1, 'Blessed by fate. The best slices are much bigger.', 0.8],
  ['Fate Itself', 0.35, 'You ARE fate. Best results almost every time.', 1.1]
];

export const ELEMENTS = [
  ['Fire', 5, 'Your attacks burn. Fire is your power color.'], ['Water', 5, 'Water flows through your attacks.'],
  ['Lightning', 5, 'Your hits crackle with lightning.'], ['Ice', 5, 'Your attacks freeze what they touch.'],
  ['Earth', 5, 'Rock and ground answer to you.'], ['Wind', 5, 'Your attacks hit like a storm.'],
  ['Light', 3.5, 'Holy light. Strong against darkness and demons.'], ['Shadow', 3.5, 'Darkness. Strong against light and angels.'],
  ['Poison', 3.5, 'Your attacks poison over time.'], ['Metal', 3, 'Steel and iron obey you.'],
  ['Nature', 3, 'Plants and life grow from your power.'], ['Blood', 2, 'Your power comes from blood itself.'],
  ['Sound', 2, 'Your attacks are shockwaves of sound.'], ['Gravity', 1.6, 'Your attacks crush with gravity.'],
  ['Space', 1.2, 'You bend space itself.'], ['Time', 1, 'Your attacks touch time.'],
  ['Void', 0.8, 'Pure nothingness. It erases what it hits.'], ['Chaos', 0.8, 'Random and wild. Nobody can predict it.'],
  ['Cosmic', 0.6, 'The power of stars and galaxies.'], ['None', 6, 'No element. Pure raw power.']
];

export const AURA = [
  ['Red', 5, 'A red aura blazes around you when you power up.', '#ff3b3b'],
  ['Blue', 5, 'A blue aura flows around you.', '#3b8bff'],
  ['Gold', 3.5, 'A golden aura. People feel like bowing.', '#ffcc33'],
  ['Purple', 4, 'A purple aura. Mysterious and scary.', '#a64bff'],
  ['Green', 4, 'A green aura full of life.', '#3fdc6a'],
  ['White', 3, 'A pure white aura. Calm and holy.', '#f2f6ff'],
  ['Black', 3, 'A black aura that eats the light around you.', '#141018'],
  ['Pink', 3, 'A bright pink aura.', '#ff5fbf'],
  ['Orange', 4, 'An orange aura like a fire.', '#ff8a2a'],
  ['Cyan', 3.5, 'A cyan aura like electric ice.', '#33e6ff'],
  ['Silver', 2.5, 'A shining silver aura.', '#c9d2dc'],
  ['Rainbow', 1, 'A rainbow aura. Super rare.', 'rainbow'],
  ['Crimson Black', 1.5, 'Black aura with red lightning. Villain energy.', '#7a0010'],
  ['Galaxy', 0.8, 'Your aura looks like a moving galaxy.', 'galaxy']
];

export const FIGHT_STYLES = [
  ['Boxing', 5, 'Fast punches, head movement, knockouts.'], ['Karate', 5, 'Strong straight strikes and kicks.'],
  ['Kung Fu', 5, 'Flowing moves, animal styles, fast hands.'], ['Muay Thai', 4.5, 'Elbows, knees and shin kicks.'],
  ['Capoeira', 3.5, 'Spinning kicks like a dance.'], ['Taekwondo', 4.5, 'High, fast, spinning kicks.'],
  ['Jiu-Jitsu', 4, 'Grabs, locks and chokes on the ground.'], ['Wrestling', 4, 'Slams, takedowns and throws.'],
  ['Judo', 3.5, 'Throws people using their own force.'], ['Street Brawling', 6, 'No rules. Anything goes.'],
  ['Krav Maga', 3, 'Brutal moves that end fights fast.'], ['Sword Style', 4, 'Your body moves like a blade master.'],
  ['Dual Wield Style', 2.5, 'You fight with a weapon in each hand.'], ['Drunken Fist', 2, 'Wobbly, unpredictable, hard to hit.'],
  ['Ninjutsu', 3, 'Stealth, tricks and quick kills.'], ['Sumo', 2, 'Huge power, push everyone out.'],
  ['Mixed Martial Arts', 4, 'A bit of everything.'], ['Assassin Style', 2.5, 'Strike first from the shadows.'],
  ['Divine Style', 0.8, 'A fighting style taught by gods.'], ['Instinct Style', 1, 'Your body fights by itself, perfectly.']
];

export const TRANSFORMATIONS = [
  ['None', 18, 'No transformation. What you see is what you get.', 0],
  ['Beast Form', 4, 'You turn into a huge beast. +1 tier while transformed.', 1],
  ['Golden Form', 3, 'Your body glows gold. +2 tiers while transformed.', 2],
  ['Dragon Form', 2.5, 'You become a dragon. +2 tiers while transformed.', 2],
  ['Demon Form', 3, 'Horns, dark aura, demon power. +1 tier.', 1],
  ['Angel Form', 2.5, 'Wings of light, holy power. +1 tier.', 1],
  ['Shadow Form', 3, 'You turn into living shadow. Hard to hit. +1 tier.', 1],
  ['Titan Form', 2, 'You grow to giant size. +2 tiers.', 2],
  ['Elemental Form', 3, 'Your body becomes your element. +1 tier.', 1],
  ['Berserk Form', 3.5, 'Pure rage. Stronger, but you can\'t think. +1 tier.', 1],
  ['Limit Break', 1.5, 'You break your limits. +3 tiers for a short time.', 3],
  ['God Form', 0.6, 'You become a god for a moment. +4 tiers.', 4]
];

export const POWER_COUNT = [
  ['None', 30, 'No powers. Just you and your body.', 0], ['1', 22, 'One power.', 1], ['2', 16, 'Two powers.', 2],
  ['3', 10, 'Three powers.', 3], ['4', 6, 'Four powers.', 4], ['5', 3, 'Five powers.', 5], ['6', 1, 'Six powers. Crazy.', 6]
];

export const YES_NO = (yes, no) => [['Yes', yes, 'Yes.'], ['No', no, 'No.']];

export const IMPROVES = [
  ['Strength', 1, 'Spin your strength wheel again (it can go DOWN).', 'str'],
  ['IQ', 1, 'Spin your IQ wheel again (it can go DOWN).', 'iq'],
  ['Power mastery', 1, 'Spin your power mastery again.', 'pm'],
  ['Weapon mastery', 1, 'Spin your weapon mastery again.', 'wm'],
  ['Fighting experience', 1, 'Spin your fighting skills again.', 'fight'],
  ['Durability', 1, 'Spin your durability wheel again (it can go DOWN).', 'dur'],
  ['Speed', 1, 'Spin your speed wheel again (it can go DOWN).', 'spd']
];

// Color of each slice in "What improves?" (matches each stat wheel's color)
export const IMPROVE_COLORS = { str: '#d41f1f', iq: '#0f6a78', pm: '#3d6b16', wm: '#5a1c8a', fight: '#8a1010', dur: '#a01452', spd: '#d8d000' };

export const DO_NOW = [
  ['Train', 4.6, 'Train hard. One of your stats gets spun again.'],
  ['Study', 4.6, 'Read and learn. Your IQ or mastery gets spun again.'],
  ['Explore', 4.6, 'Go somewhere new. Anything can happen there.'],
  ['Fight a Monster', 4.6, 'Fight a monster. Win = you might get stronger. Lose = you die.'],
  ['Complete a Quest', 4.6, 'Take a quest. Finish it for a reward.'],
  ['Become a Mercenary', 4.6, 'Get hired for dangerous jobs and get paid.'],
  ['Create an Organization', 4.6, 'Start your own group with members.'],
  ['Recruit Followers', 4.6, 'Get people who follow you everywhere.'],
  ['Make an Ally', 4.6, 'Someone becomes your friend in fights.'],
  ['Make an Enemy', 4.6, 'Someone now wants you gone. They will hunt you.'],
  ['Build a Kingdom', 4.6, 'Build your own kingdom and rule it.'],
  ['Invent Something', 4.6, 'Make armor, a weapon, medicine or a spell.'],
  ['Learn a New Skill', 4.6, 'Learn a new skill you can use.'],
  ['Learn a New Spell', 4.6, 'Learn a new spell you can cast.'],
  ['Find a Treasure', 4.6, 'Find a treasure. Could be amazing, could be cursed.'],
  ['Tame a Beast', 4.6, 'Tame a beast that fights for you.'],
  ['Go to War', 4.6, 'Go to war. Win big or get captured, spared or killed.'],
  ['Conquer a Territory', 4.6, 'Take over a realm or land.'],
  ['Start a Business', 4.6, 'Start a business and see how it goes.'],
  ['Evolve', 4.6, 'Your body evolves. One of your stats gets spun again.'],
  ['Enter the World', 13, 'Stop spinning and go live in your world with everything you got.']
];

export const WORLDS = [
  ['Fantasy Kingdom', 5, 'Castles, villages, forests, monsters and guilds.', 'fantasy'],
  ['Modern City', 5, 'Streets, buildings and cars. Superhero vibes.', 'city'],
  ['Anime Battle Islands', 4, 'Floating islands, a giant arena, glowing sky.', 'islands'],
  ['Demon Realm', 3.5, 'Lava, bones and demons everywhere.', 'demon'],
  ['Frozen Wasteland', 3.5, 'Snow, ice storms and frozen ruins.', 'frozen'],
  ['Space Station', 3, 'A huge station in space with aliens and robots.', 'space']
];

// When someone beats you: weights shift by who beat you (see flow.js)
export const DO_TO_YOU = [
  ['Spare', 4, 'They let you live. You walk away hurt.', 'spare'],
  ['Capture', 3, 'They lock you up. You have to escape.', 'capture'],
  ['Kill', 3, 'They kill you. Your run is over.', 'kill']
];
