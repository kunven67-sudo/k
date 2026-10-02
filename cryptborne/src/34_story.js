
// =====================================================================
// STORY — The Missing Brother. Notes, cutscene scripts, endings.
// Dad's name is Aldric Vane. Finn is the hero's younger brother.
// =====================================================================
const NOTES = {
  n0: { title: "Finn's note", where: 'home', text: "I heard Dad again tonight. He said he isn't dead. He said he's waiting for me down in the crypts, and that he's cold, and that he's sorry.\n\nI know how it sounds. Don't follow me. I'll bring him home.\n\n— Finn" },
  n1: { title: "Finn's journal: Night one", where: 'mossy', text: "The voice came again. It called me 'little ember'. That's what Dad called me when I was small. Nobody else knows that.\n\nI'm going down." },
  n2: { title: "Finn's journal: A torn page", where: 'mossy', text: "Slimes everywhere. I lost my lantern. The voice says the dark won't hurt me if I keep walking toward it.\n\nSo I keep walking." },
  n3: { title: "Finn's journal: The goblins", where: 'warrens', text: "The goblins ran when they saw me. One of them pointed at something behind me and screamed.\n\nThere was nothing there. I checked twice." },
  n4: { title: 'A goblin drawing', where: 'warrens', text: "Scratched into the wall: a tall shape with a crown, and a small figure following it on a leash.\n\nUnder it, in clumsy goblin marks: DONT FOLLOW." },
  n5: { title: "Finn's journal: Rings", where: 'bonecrypt', text: "These skeletons wear Emberfall rings. Some of them are the hunters who went missing years ago. Dad's friends.\n\nWere they looking for him too? Or did he bring them here?" },
  n6: { title: 'Old research page', where: 'bonecrypt', text: "...the vessel must be young, and it must come willingly. Blood calls to blood. A son will answer his father's voice when he answers nothing else.\n\n— A." },
  n7: { title: "Finn's journal: The seals", where: 'webspire', text: "Dad told me about four seals in the far lands: the Mire, the Peaks, the Sun and the Tide. He says they chain him in the dark.\n\nIf I break them, he can come home. I'm scared. I'm going anyway." },
  n8: { title: "Finn's journal: For you", where: 'webspire', text: "If you're reading this, you followed me. Of course you did. You always do.\n\nGo home. Please. I can hear Dad crying at night. I have to help him." },
  n9: { title: 'Old research page', where: 'forge', text: "Fire purifies nothing. It only teaches flesh to fear. I will not fear. I will not rot.\n\nTen years in the dark is nothing to a man who will live forever.\n\n— A." },
  n10: { title: "Finn's journal: Cold hands", where: 'forge', text: "My hands are cold all the time now. When I sleep I dream of a crown.\n\nDad says that's normal. Dad says a lot of things." },
  n11: { title: "A witch's warning", where: 'mirefen', text: "To the boy with the borrowed sword: the seal in my hollow keeps something worse than me asleep. Turn back.\n\n— Morra\n\n(Someone has torn this note in half and stuck it back together.)" },
  n12: { title: "Finn's journal: The first seal", where: 'witchwood', text: "I broke it. It screamed like a living thing.\n\nDad sounded so happy. I've never heard him that happy." },
  n13: { title: 'Old research page', where: 'witchwood', text: "The hags taught me how to keep a heart in a jar. Mine is not in a jar. Mine is in a gem, where no one will think to look.\n\n— A." },
  n14: { title: 'A frozen letter', where: 'frostpeak', text: "Sigrid, the boy came through the pass alone. He didn't feel the cold. His breath didn't steam.\n\nI don't think he's alive the way we are. Keep the children inside.\n\n— Harald" },
  n15: { title: "Finn's journal: The second seal", where: 'frostfang', text: "It's colder inside me than out here.\n\nI forgot your birthday. I tried to remember Mom's face and I couldn't." },
  n16: { title: 'Old research page', where: 'frostfang', text: "Each broken seal feeds the vessel to me a little more. By the fourth, the boy will have no voice left but mine.\n\n— A." },
  n17: { title: "A caravan's tally", where: 'sunscar', text: "Rashid's log. Boy seen at the oasis. Paid with an Emberfall coin. Asked which way the Sun King sleeps.\n\nSmiled with a grown man's smile. The camels wouldn't go near him." },
  n18: { title: "Finn's journal: The third seal", where: 'sunking', text: "I asked Dad why he left us. He said he didn't leave. He said he chose.\n\nI don't understand the difference anymore." },
  n19: { title: 'Old research page', where: 'sunking', text: "I watched them bury an empty coffin. My wife wept. My sons wept. I felt nothing, and I knew then that I had succeeded.\n\n— Aldric Vane" },
  n20: { title: "Captain Vey's log", where: 'saltmarrow', text: "A boy bought passage to the wreck of the Galleon at midnight. Paid double.\n\nHe talked to the sea the whole way, like it was someone he loved. Not rowing that route again." },
  n21: { title: "Finn's journal: The last seal", where: 'galleon', text: "Last one. Then Dad comes home and we'll all be together again. That's what he says.\n\nWhy does it sound like a lie when I write it down?" },
  n22: { title: "Finn's journal: Shaky writing", where: 'galleon', text: "brother if you find this\n\ni cant stop my feet. they walk where he wants.\n\nplease. please dont stop following." },
  n23: { title: 'Old research page', where: 'tomb', text: "The crown is ready. The vessel is ready. If the elder child comes, I will offer a trade.\n\nLove makes people stupid. I am counting on it.\n\n— Aldric" },
  n24: { title: "Finn's journal: The last page", where: 'tomb', text: "I remember now. The fireflies by the river. You carrying me home on your back when I twisted my ankle.\n\nWhatever happens: I remember you." },
  n25: { title: "Dad's grave", where: 'vale', text: "ALDRIC VANE. Beloved father.\n\nThe soil was never disturbed. Someone has scratched words into the stone below the name:\n\nHE IS NOT HERE." },
};
const NOTE_IDS = Object.keys(NOTES).filter((k) => k !== 'n0');
const NOTES_NEEDED = Math.ceil(NOTE_IDS.length / 2); // 13 of 25 to reach Finn

// who speaks: portrait look + name colour
const SPEAKERS = {
  you: { name: null, col: '#f2e6c8' }, finn: { name: 'Finn', col: '#9be04a' }, hollow: { name: 'Finn', col: '#d8454a' },
  voice: { name: 'The voice', col: '#b878ea' }, lich: { name: 'The Lich', col: '#7ff8ff' }, dad: { name: 'Aldric', col: '#7ff8ff' },
  tobin: { name: 'Elder Tobin', col: '#f2c13a' }, narrator: { name: null, col: '#cdc4b4' }, shadow: { name: 'Shadow You', col: '#d8454a' },
};
const FINN_LOOK = (look) => ({ skin: look.skin, hair: look.hair, hairStyle: 0, shirt: '#5a8a3a', shirtDark: '#3d6a2a', pants: '#4a3a2a', shoes: '#2a1a10' });
const DAD_LOOK = { skin: '#b8b0a8', hair: '#e8e0d8', hairStyle: 2, beard: '#e8e0d8', robe: '#3a1a50', shirt: '#3a1a50', shoes: '#2a1040' };

// cutscenes: lists of steps run by Story.play()
const SCENES = {
  opening: [
    ['music', 'sad'], ['title', 'EMBERFALL', 'The night Finn left'], ['fade', 'in', 1.4], ['wait', 0.6],
    ['say', 'you', '...Finn?'], ['call', 'standUp'], ['move', 'you', 'finnbed'],
    ['say', 'narrator', "His bed is empty. The blanket is cold. His sword is gone from the wall."],
    ['move', 'you', 'table'], ['sfx', 'page'], ['note', 'n0'],
    ['say', 'you', "Dad died ten years ago, Finn. What did you hear?"],
    ['fade', 'out', 1.2], ['call', 'openingOutside'], ['music', 'town'], ['fade', 'in', 1],
    ['say', 'tobin', "There you are. I saw your brother running toward Mossy Hollow before dawn, with a sword too big for him."],
    ['say', 'tobin', "The crypts swallow people, child. Your father went down there ten years ago and never came back."],
    ['say', 'you', "Then I'm not losing Finn too."],
    ['say', 'tobin', "Then take this map. Mara sells potions, Brom sells steel. Follow his trail. He always did leave a mess behind him."],
    ['call', 'giveMap'],
  ],
  boss_mossy: [['vision', 1], ['say', 'finn', 'Dad? Is that really you?'], ['say', 'voice', 'Deeper, little ember. Come deeper.'], ['vision', 0]],
  boss_warrens: [['vision', 1], ['say', 'finn', 'The goblins ran from me. They kept pointing at something behind me.'], ['say', 'voice', 'Let them run. They know what you will become.'], ['vision', 0]],
  boss_bonecrypt: [['vision', 1], ['say', 'voice', 'Your brother follows you. Good. I have missed you both.'], ['say', 'finn', 'Leave them out of this! You said it was only me!'], ['vision', 0]],
  boss_webspire: [['vision', 1], ['say', 'voice', 'Four seals in four far lands chain me in the dark, Finn. Break them, and I come home.'], ['say', 'finn', '...Okay. For you, Dad.'], ['vision', 0]],
  boss_forge: [['vision', 1], ['say', 'voice', 'You always were the stubborn one.'], ['say', 'voice', 'My child... come home to me.'], ['say', 'you', 'That voice... Dad?'], ['vision', 0],
    ['call', 'act2'], ['say', 'narrator', 'The roads beyond the Vale are open now. Elder Tobin wants to see you in Emberfall.']],
  seal_swamp: [['vision', 1], ['say', 'narrator', 'The Seal of the Mire lies in pieces. Finn was here first.'], ['say', 'finn', 'It screamed when it broke. Dad laughed.'], ['vision', 0]],
  seal_frost: [['vision', 1], ['say', 'narrator', 'The Seal of the Peaks lies in pieces. Finn was here first.'], ['say', 'finn', "I can't feel my hands anymore. I can't feel anything."], ['vision', 0]],
  seal_sun: [['vision', 1], ['say', 'narrator', 'The Seal of the Sun lies in pieces. Finn was here first.'], ['say', 'finn', "Two more... one more. I don't remember why I'm counting."], ['vision', 0]],
  seal_sea: [['vision', 1], ['say', 'narrator', 'The Seal of the Tide lies in pieces. Finn was here first.'], ['say', 'finn', "It's done, Dad. It's done. Can I come home now?"], ['vision', 0]],
  act3: [['shake', 8], ['sfx', 'gate'], ['say', 'narrator', 'Far away in the Vale, the earth groans. The doors of Wraithmoor Tomb grind open.'], ['call', 'act3']],
  final_meet: [['music', 'sad'], ['call', 'finalStage'],
    ['say', 'lich', 'You came. Both my sons, under one roof again.'],
    ['say', 'you', "You're not my father. My father is dead."],
    ['say', 'lich', 'Your father was dying. A cough, then blood, then nothing. So he chose something else.'],
    ['call', 'unhood'],
    ['say', 'dad', 'Look at me. Ten years in the dark, and not a day older. Finn will make me whole, and we will never lose each other again.'],
    ['say', 'hollow', '...brother?'],
    ['say', 'dad', "But I am not cruel. Kneel, and take his place. Your soul for his. He walks home in the morning."],
    ['choice', "Take Finn's place?", [["Take his place", 'deal'], ['Refuse', 'fight']]],
  ],
  final_fight: [['say', 'you', "I'm taking Finn home. Both of us."], ['say', 'dad', 'Then you will both stay.'], ['music', 'final'], ['call', 'startFinal']],
  finn_turns: [['music', 'sad'], ['say', 'narrator', "The Lich crumbles to dust. But the cold in Finn's eyes doesn't leave."], ['say', 'hollow', 'He promised. He PROMISED.'], ['say', 'you', "Finn, it's me!"],
    ['say', 'hollow', "I don't... remember you."], ['say', 'narrator', "If only you'd found more of his notes. His own words might have reached him."], ['music', 'final'], ['call', 'spawnHollowFinn']],
  end_finn: [['music', 'sad'], ['say', 'narrator', 'Finn falls. For one moment his eyes are his own again.'], ['say', 'finn', 'I remember... the fireflies...'],
    ['say', 'narrator', 'You carried your brother home through the Vale at dawn, the way you did when he was small.'], ['say', 'narrator', 'You never stopped wondering what the rest of his notes would have said.'], ['end', 'finn']],
  end_good: [['music', 'sad'], ['say', 'narrator', "The Lich crumbles to dust. Finn sways, his eyes full of someone else's cold."],
    ['say', 'you', "Finn. I read your notes. The fireflies by the river. My birthday. Mom's face."], ['say', 'hollow', '...You found them?'],
    ['say', 'you', 'You left a trail so I could find you. So here I am.'], ['say', 'finn', 'Brother...'], ['say', 'narrator', 'The cold breaks like ice in spring.'],
    ['say', 'finn', 'Dad said the crypts can be sealed from the inside. If we both hold the seal...'], ['say', 'you', 'Then we hold it together.'],
    ['music', 'victory'], ['call', 'sealTogether'], ['say', 'narrator', 'The brothers sealed Wraithmoor Tomb forever. Emberfall woke to a sunrise it had almost forgotten.'], ['end', 'good']],
  end_secret: [['music', 'night'], ['call', 'bloodMoon'], ['title', 'FAR AWAY', 'In a valley beyond the mountains'],
    ['say', 'narrator', 'A blood-red moon rises over a valley you have never seen. Wolves stop howling all at once.'], ['say', 'voice', 'Hunter... the moon is hungry.'],
    ['title', 'BLOOD MOON HUNTER', 'Coming next'], ['end', 'secret']],
  end_deal: [['say', 'you', '...Let him go.'], ['say', 'finn', "No! Brother, don't!"], ['say', 'dad', 'A wise trade.'], ['call', 'dealScene'],
    ['say', 'narrator', 'Finn walked home alone at dawn. He waited at the door every night for a year.'], ['say', 'narrator', "You never came back. Deep under Wraithmoor, the Lich's throne has a new guard."], ['end', 'deal']],
  end_night: [['music', 'sad'], ['title', 'THE SUN DID NOT RISE', ''], ['say', 'narrator', 'You searched too long. Wraithmoor Tomb opened on its own, and the night swallowed the sky.'],
    ['say', 'narrator', 'Emberfall waits for a morning that will never come. Somewhere below, Finn is still walking toward his father.'], ['end', 'night']],
  mirror_open: [['shake', 5], ['sfx', 'gate'], ['say', 'narrator', "Every page of Finn's journal glows at once. Somewhere in the west of the Vale, glass cracks."], ['say', 'narrator', 'The Mirror Crypt has opened.']],
  shadow_meet: [['music', 'sad'], ['say', 'shadow', 'You read every page. You walked every road. You never stopped.'], ['say', 'shadow', 'So did I.'], ['say', 'you', 'Who are you?'],
    ['say', 'shadow', "The part of you that would have stayed in the dark. Let's see which of us gets to leave."], ['music', 'final']],
  shadow_down: [['say', 'narrator', 'Your shadow shatters like a mirror. In every shard you see your own face: tired, older, alive.']],
};
const ENDINGS = {
  good: { title: 'GOOD ENDING', sub: 'Brothers, together' },
  secret: { title: 'SECRET ENDING', sub: 'The moon is hungry' },
  finn: { title: 'BAD ENDING', sub: 'You had to stop him' },
  deal: { title: 'BAD ENDING', sub: 'You took his place' },
  night: { title: 'BAD ENDING', sub: 'Eternal night' },
};

// what townsfolk say as the story moves on (act -> line)
const TALK = {
  tobin: { 1: ["Follow Finn's trail through the Vale's dungeons. He left notes; keep them. They might matter more than you think.", 'Slimes in Mossy Hollow, goblins in the Warrens, bones in Bonecrypt. Your brother went through all of it.'],
    2: ["Your father's voice... Aldric was my friend. Four seals lie in the four lands: the Mire to the west, the Peaks to the north, the Sun to the south and the Tide to the east.", 'If the boy is breaking those seals, something wants out of Wraithmoor Tomb. Stop him before the last one breaks.'],
    3: ['Wraithmoor Tomb is open. Whatever waits in there has your father\'s voice. Do not let it have your heart.'] },
  mara: ['Finn bought three potions last week. Said he was going camping. I should have known.', 'Sell me your monster junk. I pay fair. Mostly.'],
  brom: ['Bring me monster parts and coin and I can make any weapon sharper. Past +5 the steel gets stubborn, though. It can crack.', 'Gems? Set them in your gear. Rubies burn, emeralds poison, sapphires freeze.'],
  hollis: ['A pet that levels up with you is the best friend you will ever have. Ravens are clever, they find hidden things.'],
  pip: ['I saw a Slime eat a whole boot once.', 'Finn told me he was going to bring your dad back. I thought he was joking.'],
  wren: ['The Goblin Warrens smell like old socks.', 'Mom says not to go near the graveyard. Your dad\'s grave is there. It looks... wrong.'],
  oskar: ['They say the Lich carries a sword made from a dragon.', 'At night the dead walk the roads. Stay near the lamps.'],
  lena: ["Brom forged my dad's shield. It stopped a Skeleton Knight!", 'If you block right before a hit, you can stun almost anything.'],
  nell: ['Captain Vey pays well, but never ask about his leg.'],
  morra: ['Your brother came through here. I warned him. Boys never listen.'],
  sigrid: ['The cold up here cuts deeper than claws. Eat, sleep near fire, keep moving.'],
  rashid: ['Sandstorms hide scorpions. Listen for the clicking.'],
  vey: ['The Galleon sank with all hands. Some of them still crew her.'],
};

// quest templates
const QUEST_GIVERS = {
  pip: { map: 'vale', likes: ['hunt', 'collect'] }, wren: { map: 'vale', likes: ['rescue', 'deliver'] }, oskar: { map: 'vale', likes: ['hunt', 'rescue'] }, lena: { map: 'vale', likes: ['collect', 'deliver'] },
  morra: { map: 'mirefen', likes: ['collect', 'hunt'] }, sigrid: { map: 'frostpeak', likes: ['hunt', 'rescue'] }, rashid: { map: 'sunscar', likes: ['deliver', 'collect'] }, nell: { map: 'saltmarrow', likes: ['rescue', 'hunt'] },
};
const RESCUE_NAMES = ['Tam', 'Ilsa', 'Bram', 'Corin', 'Maeve', 'Joss', 'Edda', 'Rolf', 'Nim', 'Pell'];
const RESCUE_RELS = ['cousin', 'sister', 'brother', 'friend', 'uncle', 'daughter', 'apprentice'];
