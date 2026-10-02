
// =====================================================================
// STORY — Greywater Vale. You grew up here, left as a child, and came
// back a rookie hunter to find the valley cursed. Lord Aldous Vargrave
// traded his people's lives to the demon Azgoreth to live forever, and
// every seventh night the moon turns red and the demon feeds.
// No voice acting: everything is text (with soft blips while it types).
// =====================================================================
const PEOPLE = {
  hale: { name: 'Captain Hale', role: 'Captain of the Watch', look: { skin: '#c89068', hair: '#5a5a5a', beard: '#5a5a5a', coat: '#2a3a4a', shirt: '#8a8e98', body: 2, helm: 0 }, at: [12, 132], blip: 0.72 },
  maud: { name: 'Old Maud', role: 'Alchemist', look: { skin: '#e0b090', hair: '#d8d0c8', coat: '#3a4a2a', shirt: '#6a5a4a', body: 0, hood: 1 }, at: [40, 152], shop: 'alchemist', blip: 0.9 },
  brann: { name: 'Tomas Brann', role: 'Blacksmith', look: { skin: '#a06a48', hair: '#1a1410', beard: '#1a1410', coat: '#4a3a2a', shirt: '#6a3020', body: 2, apron: 1 }, at: [-30, 116], shop: 'smith', job: 'hammer', blip: 0.68 },
  elsa: { name: 'Elsa', role: 'Innkeeper', look: { skin: '#f2d0b0', hair: '#8a2a1a', coat: '#5a2a24', shirt: '#d8d0c0', body: 1 }, at: [26, 116], shop: 'inn', blip: 1.1 },
  edrin: { name: 'Father Edrin', role: 'Priest', look: { skin: '#e0b090', hair: '#3a2414', coat: '#1a1a1a', shirt: '#d8d0c0', body: 1, robe: 1 }, at: [-6, 196], shop: 'chapel', blip: 0.82 },
  pella: { name: 'Pella', role: 'Farmer', look: { skin: '#c89068', hair: '#d8b070', coat: '#4a5a2a', shirt: '#d8d0c0', body: 1 }, at: [118, 214], blip: 1.05 },
  morwen: { name: 'Morwen', role: 'The witch of Blackmire', look: { skin: '#b8c0a0', hair: '#2a2a30', coat: '#2a2a1a', shirt: '#4a3a4a', body: 0, robe: 1, hood: 1 }, at: [-540, 10], blip: 0.86 },
  vargrave: { name: 'Lord Aldous Vargrave', role: 'Lord of Greywater', look: { skin: '#e8e0d8', hair: '#e8e8e8', coat: '#3a0a10', shirt: '#1a1a1a', body: 1, cape: 1 }, blip: 0.6 },
};
// townsfolk who wander, work and go home at night
const TOWNSFOLK = [
  { name: 'Willem', look: { skin: '#e0b090', hair: '#6a4024', coat: '#5a4a3a', shirt: '#8a7a6a', body: 1 } },
  { name: 'Agnes', look: { skin: '#f2d0b0', hair: '#a06a34', coat: '#4a2a30', shirt: '#d8d0c0', body: 0 } },
  { name: 'Bram', look: { skin: '#a06a48', hair: '#1a1410', beard: '#1a1410', coat: '#3a3028', shirt: '#5a2a24', body: 2 } },
  { name: 'Ilse', look: { skin: '#e0b090', hair: '#d8b070', coat: '#2a3a4a', shirt: '#d8d0c0', body: 0 } },
  { name: 'Odo', look: { skin: '#c89068', hair: '#3a2414', coat: '#4a3a2a', shirt: '#8a7a6a', body: 1 } },
  { name: 'Greta', look: { skin: '#f2d0b0', hair: '#e8e0d0', coat: '#3a2a20', shirt: '#6a5a4a', body: 1 } },
];
const SPEAKER_COL = { you: '#e8d8b0', hale: '#a0b8d8', maud: '#a0c890', brann: '#d8a070', elsa: '#e89080', edrin: '#d8d0c0', pella: '#d8c070', morwen: '#9fd0a0', vargrave: '#ff6060', narrator: '#b8b0a0', azgoreth: '#ff4020' };
// the main story: each step has an objective, a marker and what finishes it
const MAIN = [
  { id: 'arrive', title: 'Homecoming', goal: 'Talk to Captain Hale at the contract board in Ashford.', marker: 'hale' },
  { id: 'mill', title: 'The Mill Beast', goal: 'Investigate the Old Mill. Use hunter sense (R) to find clues.', marker: [-78, 296] },
  { id: 'trail', title: 'The Mill Beast', goal: 'Follow the blood trail into Wolfwood.', marker: 'trail' },
  { id: 'beast', title: 'The Mill Beast', goal: 'Kill the Mill Beast at the Wolf Den.', marker: [372, -20] },
  { id: 'locket', title: 'The Mill Beast', goal: 'Bring Jonah\'s locket to Captain Hale.', marker: 'hale' },
  { id: 'edrin', title: 'Silver Tongues', goal: 'Ask Father Edrin at the Chapel of the Dawn about the curse.', marker: 'edrin' },
  { id: 'journal', title: 'Silver Tongues', goal: 'Find the old records at the ruined chapel in St. Aldric\'s Graveyard.', marker: [448, 268] },
  { id: 'witch', title: 'The Witch of Blackmire', goal: 'Find Morwen in the Blackmire swamp.', marker: 'morwen' },
  { id: 'mire', title: 'The Witch of Blackmire', goal: 'Kill the Mire Mother at the Drowned Nest.', marker: [-430, 140] },
  { id: 'pact', title: 'The Witch of Blackmire', goal: 'Return to Morwen.', marker: 'morwen' },
  { id: 'key', title: 'Keys and Horns', goal: 'Take the Iron Key from Old Grum under the Old Stone Bridge. (Optional: hunt the Wyvern Queen for the Demon\'s Horn.)', marker: [-58, -168] },
  { id: 'castle', title: 'Castle Vargrave', goal: 'Open the castle gate and enter the great hall.', marker: [360, -356] },
  { id: 'choice', title: 'The Lord of Greywater', goal: 'Decide the fate of the valley.', marker: [360, -356] },
  { id: 'shrine', title: 'The Hunger Below', goal: 'Enter the Hungering Shrine in the western mountains and kill Azgoreth.', marker: [-650, -390] },
  { id: 'done', title: 'Free Roam', goal: 'The story is over. Hunt, explore and chase the other endings.', marker: null },
];
const MAIN_IDX = Object.fromEntries(MAIN.map((m, i) => [m.id, i]));
// conversations: lists of [speaker, text]; 'you' lines are your hunter's
const TALKS = {
  opening: [['narrator', 'Greywater Vale. You were nine when your mother died and the carts took you south. Fifteen years later, you ride back in the rain.'], ['narrator', 'The letters said the valley was cursed. The letters stopped coming. Nobody sends for a rookie hunter unless every real hunter is already dead.'], ['narrator', 'Ashford is ahead. The moon over it is a thin pale sliver. It won\'t stay that colour.']],
  hale_first: [['hale', 'You\'re the hunter? Gods. You\'re a child.'], ['you', 'I\'m twenty-four. And I was born here.'], ['hale', 'Then you know what this place used to be. Now look at it. Every seventh night the moon goes red and something takes a family.'], ['hale', 'Last week it was the Old Mill. Something came through the door. Took the miller in pieces. His boy Jonah is missing.'], ['hale', 'The board\'s yours. Start with the mill. Look closely. Things leave tracks if you know how to see them.'], ['narrator', 'Press R to use your hunter sense. Clues, tracks and blood glow red.']],
  mill_found: [['you', 'Claw marks. Too big for a wolf. And the blood leads east, into Wolfwood.']],
  beast_dies: [['narrator', 'The beast falls. Its body twists, shrinks, and the fur falls away.'], ['narrator', 'It is a boy. Sixteen at most. A locket hangs from his neck.'], ['you', '...Jonah.']],
  hale_locket: [['hale', 'Jonah. Damn it.'], ['hale', 'His family was taken to the castle last winter. "Service to the Lord," the guards said. Nobody comes back from service.'], ['hale', 'The locket has the Vargrave crest. If anyone knows what\'s happening up there, it\'s Father Edrin. When he\'s sober.']],
  edrin: [['edrin', 'The hunter. Sit. Drink with me. No? Then listen.'], ['edrin', 'Forty years ago Lord Vargrave caught the plague. He was dying. And then he wasn\'t. That same autumn, the first blood moon.'], ['edrin', 'Father Aldric kept records of everything. He hid them in the old chapel at the graveyard before the ghouls took it.'], ['edrin', 'Go at day if you have any sense. At night, the dead walk there.']],
  journal: [['narrator', 'Under the altar: a waxed bundle of pages. Father Aldric\'s hand, shaking.'], ['narrator', '"The Lord did not recover. He bargained. A voice under the western mountain. A hunger that wants a valley to eat, one family at a time."'], ['narrator', '"The witch of Blackmire knows its name. God forgive me, I never had the courage to ask her."']],
  morwen_first: [['morwen', 'A hunter with a dead priest\'s pages. You want a name. Names cost.'], ['morwen', 'There\'s a mother in my swamp. She lays her drowners in the reeds by my door and they steal my herbs. Kill her.'], ['you', 'And then you\'ll talk?'], ['morwen', 'And then I\'ll talk.']],
  morwen_pact: [['morwen', 'She\'s dead? Good. You may live long enough to be useful.'], ['morwen', 'The thing under the mountain is Azgoreth. The Hunger Below. Aldous Vargrave fed it his people for forty years, and it gave him forever.'], ['morwen', 'Kill the lord and his half of the pact breaks. The curse dies with him. Most of it.'], ['morwen', 'Or kill the demon itself. For that you need its horn. The Wyvern Queen swallowed it, in the north. And a blade that can cut it.'], ['morwen', 'Either way, the castle gate is barred. A troll under the Old Stone Bridge robbed the smugglers who used to open it. Old Grum has their key.'], ['morwen', 'Take this charm. It will hum near the demon\'s things.']],
  castle_hall: [['narrator', 'The great hall is warm. There are candles everywhere, and a long table set for a feast nobody has eaten.'], ['vargrave', 'Ah. The hunter. Welcome home.'], ['vargrave', 'Your mother died in my valley, did she not? A fever. So many fevers.'], ['vargrave', 'Let me save you some trouble. You can kill me. Azgoreth will still be hungry, and it will find another lord.'], ['vargrave', 'Or... you could take my place. Live forever. Feed it a little, and keep the rest safe. Someone has to.']],
  vargrave_dies: [['narrator', 'Lord Vargrave crumbles like old paper. Forty stolen years catch up with him in a breath.'], ['narrator', 'Outside, the moon pales. The pact is broken.']],
  azgoreth_meet: [['azgoreth', 'A LITTLE HUNTER. CARRYING MY HORN.'], ['azgoreth', 'I HAVE EATEN KINGS. I WILL EAT YOUR VALLEY, AND THEN THE NEXT.'], ['you', 'Not this one.']],
  azgoreth_dies: [['narrator', 'The demon screams, and the mountain screams with it. Far to the east, in his castle, Lord Vargrave crumbles to dust mid-sentence.'], ['narrator', 'The Hunger Below is dead. The valley will never see a blood moon again.']],
  deal: [['narrator', 'You take the lord\'s hand. It is cold, and then you are cold.'], ['vargrave', 'There. Was that so hard?'], ['narrator', 'He crumbles. You don\'t. The hall\'s candles lean toward you now. Somewhere under the mountain, something smiles.']],
};
const ENDINGS = {
  lord: { title: 'THE LORD\'S END', sub: 'You killed Lord Vargrave and broke his pact.', text: 'The blood moons stop. Ashford buries its dead and starts to plant again. But on quiet nights, far under the western mountain, something is still hungry, and waiting for the next fool with a bargain.', good: true },
  demon: { title: 'DEMONSLAYER', sub: 'You killed Azgoreth, the Hunger Below.', text: 'The pact dies with the demon, and the lord dies with the pact. Greywater Vale wakes to a white moon. The children of Ashford will tell your story until they are old.', good: true },
  dark: { title: 'THE NEW LORD', sub: 'You took the deal.', text: 'You live forever. Every seventh night you choose a family. You tell yourself it keeps the rest safe. After a while, you stop telling yourself anything at all. (A dark ending. Your save goes back to before you met the lord.)', good: false },
};
// side contracts on the board
const CONTRACT_KINDS = [
  { kind: 'kill', mon: 'wolf', n: [5, 8], text: (n) => `Wolves are killing sheep at the farms. Kill ${n} wolves.`, coins: 22, xp: 14 },
  { kind: 'kill', mon: 'drowner', n: [5, 8], text: (n) => `Drowners pulled a fisherman under at the lake. Kill ${n} drowners.`, coins: 26, xp: 18 },
  { kind: 'kill', mon: 'ghoul', n: [6, 9], text: (n) => `Ghouls are digging up St. Aldric's graves at night. Kill ${n} ghouls.`, coins: 28, xp: 20 },
  { kind: 'kill', mon: 'deer', n: [3, 5], text: (n) => `The inn needs venison. Hunt ${n} deer.`, coins: 14, xp: 8 },
  { kind: 'lair', mon: 'werewolf', name: 'The Butcher of Wolfwood', trophy: 'c_werewolf', text: 'Something tears sheep apart in Wolfwood and leaves the wool. Find its lair and kill it.', coins: 260, xp: 300, lvl: 4 },
  { kind: 'lair', mon: 'ghoul', name: 'Gravecaller', trophy: 'c_ghoul', big: 1.6, text: 'A huge ghoul leads the pack at night. Track it to its nest.', coins: 180, xp: 220, lvl: 3 },
  { kind: 'lair', mon: 'vampire', name: 'The Pale Widow', trophy: 'c_vampire', text: 'Travellers on the castle road are found bloodless. Find who is feeding.', coins: 320, xp: 380, lvl: 6 },
  { kind: 'lair', mon: 'drowner', name: 'Old Bog-Maw', trophy: 'c_drowner', big: 1.8, text: 'Something huge lives under the water near the mill. Find it.', coins: 200, xp: 240, lvl: 3 },
  { kind: 'lair', mon: 'troll', name: 'Stonebelly', trophy: 'c_troll', text: 'A troll has taken a bridge and eats whoever won\'t pay. Teach it a lesson.', coins: 380, xp: 420, lvl: 7 },
  { kind: 'lair', mon: 'wyvern', name: 'Redwing', trophy: 'c_wyvern', text: 'A red wyvern takes cattle from the high pastures. Hunt it.', coins: 420, xp: 460, lvl: 8 },
  { kind: 'lair', mon: 'blood_fiend', name: 'The Blood Fiend', trophy: 'c_fiend', text: 'Only seen under the blood moon. Bring its heart.', coins: 600, xp: 700, lvl: 9, blood: true },
];
// where named monsters hide (by monster type)
const LAIRS = {
  werewolf: [[372, -20], [250, 150], [-320, -260], [180, -60]], ghoul: [[430, 330], [470, 280], [-480, 160]], vampire: [[300, -280], [420, -260], [250, -350]],
  drowner: [[-120, 260], [180, 640], [-520, 90], [-60, 470]], troll: [[-30, -40], [40, 482], [-125, 125]], wyvern: [[-180, -620], [-320, -560], [-80, -650]], blood_fiend: [[200, 0], [-250, 200], [100, -300]],
};
