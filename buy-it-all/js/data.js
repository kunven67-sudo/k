'use strict';
// Static game data: categories, stores, items, homes, jobs, stocks, achievements.
// Prices are rough real-world prices in USD.

const CATS = {
  food:        { name: 'Food',        icon: '🍔', resale: 0 },
  drinks:      { name: 'Drinks',      icon: '🥤', resale: 0 },
  pc:          { name: 'PC Parts',    icon: '🧩', resale: 0.6 },
  electronics: { name: 'Electronics', icon: '📱', resale: 0.5 },
  furniture:   { name: 'Furniture',   icon: '🛋️', resale: 0.4 },
  vehicles:    { name: 'Vehicles',    icon: '🚗', resale: 1 },   // uses tracked value
  clothing:    { name: 'Clothing',    icon: '👕', resale: 0.25 },
  luxury:      { name: 'Luxury',      icon: '💎', resale: 1 },   // uses tracked value
  pets:        { name: 'Pets',        icon: '🐾', resale: 0 },
};

const STORES = [
  { id: 'grocery',  name: 'FreshMart',      icon: '🛒', cats: ['food', 'drinks'], blurb: 'Groceries, snacks, meals and drinks.' },
  { id: 'bytes',    name: 'Byte Bazaar',    icon: '🖥️', cats: ['pc'],           blurb: 'CPUs, graphics cards and everything to build a PC.' },
  { id: 'electro',  name: 'ElectroWorld',   icon: '📱', cats: ['electronics'],  blurb: 'Phones, laptops, consoles and gadgets.' },
  { id: 'homenest', name: 'HomeNest',       icon: '🛋️', cats: ['furniture'],    blurb: 'Beds, sofas, TVs and everything for your place.' },
  { id: 'automax',  name: 'AutoMax Motors', icon: '🚗', cats: ['vehicles'],     blurb: 'From skateboards to private jets.' },
  { id: 'style',    name: 'Style Street',   icon: '👕', cats: ['clothing'],     blurb: 'Clothes, shoes and suits for the office.' },
  { id: 'prestige', name: 'Prestige & Co.', icon: '💎', cats: ['luxury'],       blurb: 'Watches, jewelry, art, gold and lottery tickets.' },
  { id: 'paws',     name: 'Paws Pet Shop',  icon: '🐾', cats: ['pets'],         blurb: 'A friend who is always happy to see you.' },
  { id: 'realty',   name: 'City Realty',    icon: '🏠', homes: true,            blurb: 'Rent or buy a bigger place.' },
];

const ITEMS = [];
function I(cat, id, name, icon, price, extra) {
  ITEMS.push(Object.assign({ cat, id, name, icon, price, desc: '' }, extra || {}));
}

// ---------- Food (stack in your kitchen, eat any time) ----------
I('food', 'banana',    'Banana',              '🍌', 0.5, { cons: 1, fx: { hunger: 8 } });
I('food', 'apple',     'Apple',               '🍎', 1,   { cons: 1, fx: { hunger: 8, health: 1 } });
I('food', 'noodles',   'Instant noodles',     '🍜', 1.5, { cons: 1, fx: { hunger: 22, health: -1 } });
I('food', 'chips',     'Bag of chips',        '🥔', 3,   { cons: 1, fx: { hunger: 10, fun: 3 } });
I('food', 'choc',      'Chocolate bar',       '🍫', 2,   { cons: 1, fx: { hunger: 8, fun: 5 } });
I('food', 'sandwich',  'Deli sandwich',       '🥪', 7,   { cons: 1, fx: { hunger: 32 } });
I('food', 'pizza',     'Frozen pizza',        '🍕', 8,   { cons: 1, fx: { hunger: 45, fun: 3 } });
I('food', 'burger',    'Burger & fries',      '🍔', 12,  { cons: 1, fx: { hunger: 50, fun: 6, health: -1 } });
I('food', 'icecream',  'Ice cream tub',       '🍨', 6,   { cons: 1, fx: { hunger: 12, fun: 8 } });
I('food', 'salad',     'Poke bowl',           '🥗', 15,  { cons: 1, fx: { hunger: 40, health: 3 } });
I('food', 'groceries', 'Weekly grocery box',  '🧺', 75,  { cons: 1, gives: ['homemeal', 10], desc: 'Gives 10 home-cooked meals.' });
I('food', 'homemeal',  'Home-cooked meal',    '🍲', 0,   { cons: 1, fx: { hunger: 40, health: 2 }, hidden: 1 });
I('food', 'sushi',     'Sushi platter',       '🍣', 28,  { cons: 1, fx: { hunger: 45, fun: 10, health: 2 } });
I('food', 'steak',     'Steak dinner',        '🥩', 55,  { cons: 1, fx: { hunger: 70, fun: 15 } });
I('food', 'cake',      'Birthday cake',       '🎂', 35,  { cons: 1, fx: { hunger: 30, fun: 25 } });
I('food', 'caviar',    'Caviar tasting menu', '🍱', 450, { cons: 1, fx: { hunger: 60, fun: 35, health: 2 } });

// ---------- Drinks ----------
I('drinks', 'water',    'Bottle of water', '💧', 1,   { cons: 1, fx: { thirst: 25 } });
I('drinks', 'soda',     'Can of soda',     '🥤', 2,   { cons: 1, fx: { thirst: 20, fun: 3 } });
I('drinks', 'milk',     'Carton of milk',  '🥛', 3,   { cons: 1, fx: { thirst: 22, hunger: 5 } });
I('drinks', 'oj',       'Orange juice',    '🧃', 4,   { cons: 1, fx: { thirst: 30, health: 1 } });
I('drinks', 'coffee',   'Coffee',          '☕', 4,   { cons: 1, fx: { thirst: 10, energy: 15 } });
I('drinks', 'energy',   'Energy drink',    '⚡', 3.5, { cons: 1, fx: { thirst: 12, energy: 25, health: -2 } });
I('drinks', 'tea',      'Bubble tea',      '🧋', 6,   { cons: 1, fx: { thirst: 25, fun: 8 } });
I('drinks', 'smoothie', 'Fruit smoothie',  '🥤', 8,   { cons: 1, fx: { thirst: 28, hunger: 10, health: 2 } });
I('drinks', 'lemonade', 'Craft lemonade',  '🍋', 5,   { cons: 1, fx: { thirst: 30, fun: 4 } });
I('drinks', 'coconut',  'Fresh coconut',   '🥥', 7,   { cons: 1, fx: { thirst: 35, fun: 5 } });

// ---------- PC parts (installed in the PC Builder) ----------
I('pc', 'cpu1', 'Budget 4-core CPU',        '🔲', 90,    { slot: 'cpu', score: 10, watt: 65 });
I('pc', 'cpu2', 'Mid-range 6-core CPU',     '🔲', 199,   { slot: 'cpu', score: 20, watt: 88 });
I('pc', 'cpu3', 'High-end 8-core CPU',      '🔲', 379,   { slot: 'cpu', score: 35, watt: 120 });
I('pc', 'cpu4', 'Flagship 16-core CPU',     '🔲', 649,   { slot: 'cpu', score: 50, watt: 170 });
I('pc', 'cpu5', 'Workstation 64-core CPU',  '🔲', 4999,  { slot: 'cpu', score: 70, watt: 350 });

I('pc', 'gpu1', 'Entry graphics card 4GB',          '🎮', 119,   { slot: 'gpu', score: 8,   watt: 75,  mine: 0.8 });
I('pc', 'gpu2', 'Budget graphics card 8GB',         '🎮', 249,   { slot: 'gpu', score: 18,  watt: 130, mine: 2 });
I('pc', 'gpu3', 'Mid-range graphics card 12GB',     '🎮', 479,   { slot: 'gpu', score: 32,  watt: 200, mine: 4 });
I('pc', 'gpu4', 'High-end graphics card 16GB',      '🎮', 849,   { slot: 'gpu', score: 48,  watt: 285, mine: 7 });
I('pc', 'gpu5', 'Enthusiast graphics card 24GB',    '🎮', 1599,  { slot: 'gpu', score: 65,  watt: 350, mine: 11 });
I('pc', 'gpu6', 'Flagship graphics card 32GB',      '🎮', 2499,  { slot: 'gpu', score: 85,  watt: 575, mine: 16 });
I('pc', 'gpu7', 'AI datacenter accelerator 80GB',   '🧠', 30000, { slot: 'gpu', score: 100, watt: 700, mine: 120 });

I('pc', 'ram1', '8GB RAM',            '📏', 25,  { slot: 'ram', score: 3 });
I('pc', 'ram2', '16GB RAM kit',       '📏', 49,  { slot: 'ram', score: 6 });
I('pc', 'ram3', '32GB DDR5 kit',      '📏', 95,  { slot: 'ram', score: 10 });
I('pc', 'ram4', '64GB DDR5 RGB kit',  '📏', 189, { slot: 'ram', score: 13 });
I('pc', 'ram5', '128GB DDR5 kit',     '📏', 419, { slot: 'ram', score: 15 });

I('pc', 'ssd1', '500GB SATA SSD',  '💽', 39,  { slot: 'storage', score: 3 });
I('pc', 'ssd2', '1TB NVMe SSD',    '💽', 69,  { slot: 'storage', score: 6 });
I('pc', 'ssd3', '2TB NVMe SSD',    '💽', 129, { slot: 'storage', score: 9 });
I('pc', 'ssd4', '4TB Gen5 NVMe',   '💽', 319, { slot: 'storage', score: 12 });

I('pc', 'mobo1', 'Basic motherboard',   '🟩', 89,  { slot: 'mobo', score: 2 });
I('pc', 'mobo2', 'Gaming motherboard',  '🟩', 189, { slot: 'mobo', score: 5 });
I('pc', 'mobo3', 'Premium motherboard', '🟩', 419, { slot: 'mobo', score: 8 });

I('pc', 'psu1', '450W power supply',            '🔌', 45,  { slot: 'psu', cap: 450 });
I('pc', 'psu2', '650W power supply',            '🔌', 79,  { slot: 'psu', cap: 650 });
I('pc', 'psu3', '850W Gold power supply',       '🔌', 129, { slot: 'psu', cap: 850 });
I('pc', 'psu4', '1000W Platinum power supply',  '🔌', 189, { slot: 'psu', cap: 1000 });
I('pc', 'psu5', '1600W Titanium power supply',  '🔌', 419, { slot: 'psu', cap: 1600 });

I('pc', 'case1', 'Budget tower case',     '🗄️', 49,  { slot: 'case', score: 1 });
I('pc', 'case2', 'Airflow mesh case',     '🗄️', 99,  { slot: 'case', score: 3 });
I('pc', 'case3', 'Glass showcase RGB case', '🗄️', 179, { slot: 'case', score: 5 });

I('pc', 'cool1', 'Tower air cooler',      '❄️', 39,  { slot: 'cooler', score: 2 });
I('pc', 'cool2', '360mm liquid cooler',   '❄️', 149, { slot: 'cooler', score: 4 });

I('pc', 'mon1', '24" 1080p monitor',          '🖥️', 129, { slot: 'monitor', score: 2 });
I('pc', 'mon2', '27" 1440p 165Hz monitor',    '🖥️', 319, { slot: 'monitor', score: 5 });
I('pc', 'mon3', '32" 4K OLED 240Hz monitor',  '🖥️', 899, { slot: 'monitor', score: 9 });

I('pc', 'kb1',   'Mechanical keyboard',  '⌨️', 89,  { slot: 'keyboard', score: 2 });
I('pc', 'mouse1','Gaming mouse',         '🖱️', 59,  { slot: 'mouse', score: 2 });
I('pc', 'head1', 'Gaming headset',       '🎧', 99,  { slot: 'headset', score: 2 });

// ---------- Electronics ----------
I('electronics', 'phone1',   'Basic smartphone',          '📱', 199,  { perk: 'phone' });
I('electronics', 'phone2',   'Flagship smartphone',       '📱', 1199, { perk: 'phone' });
I('electronics', 'phone3',   'Foldable smartphone',       '📲', 1799, { perk: 'phone' });
I('electronics', 'laptop1',  'Budget laptop',             '💻', 549,  { laptop: 15, desc: 'Counts as a computer (score 15).' });
I('electronics', 'laptop2',  'Pro laptop',                '💻', 2499, { laptop: 45, desc: 'Counts as a computer (score 45).' });
I('electronics', 'tablet',   'Tablet',                    '📟', 499,  { perk: 'tablet', fun: 2 });
I('electronics', 'console',  'Game console',              '🕹️', 499,  { perk: 'console' });
I('electronics', 'handheld', 'Handheld game console',     '🎮', 399,  { perk: 'handheld' });
I('electronics', 'vr',       'VR headset',                '🥽', 499,  { perk: 'vr' });
I('electronics', 'anc',      'Noise-cancelling headphones', '🎧', 349, { fun: 2 });
I('electronics', 'watch',    'Smartwatch',                '⌚', 399,  { health: 1 });
I('electronics', 'speaker',  'Smart speaker',             '🔊', 99,   { fun: 1 });
I('electronics', 'drone',    'Camera drone',              '🚁', 799,  { perk: 'drone' });
I('electronics', 'camera',   'Mirrorless camera',         '📷', 1999, { perk: 'camera' });
I('electronics', 'streamkit','Streaming kit (mic + cam)', '🎙️', 249,  { perk: 'streamkit', desc: 'Lets you stream games from a working PC.' });

// ---------- Furniture (placed in your home, uses a slot) ----------
I('furniture', 'airbed',   'Air mattress',             '🛏️', 40,    { bed: 1, comfort: 1 });
I('furniture', 'bed1',     'Single bed',               '🛏️', 249,   { bed: 2, comfort: 2 });
I('furniture', 'bed2',     'Queen bed',                '🛏️', 899,   { bed: 3, comfort: 4 });
I('furniture', 'bed3',     'King memory-foam bed',     '🛏️', 2499,  { bed: 4, comfort: 6 });
I('furniture', 'beanbag',  'Bean bag',                 '🫘', 59,    { comfort: 2 });
I('furniture', 'sofa1',    'Sofa',                     '🛋️', 699,   { comfort: 4 });
I('furniture', 'sofa2',    'Leather sectional',        '🛋️', 3199,  { comfort: 7 });
I('furniture', 'desk1',    'Desk',                     '🪵', 149,   { perk: 'desk', comfort: 1 });
I('furniture', 'desk2',    'Standing desk',            '🪵', 549,   { perk: 'desk', comfort: 2 });
I('furniture', 'chair1',   'Office chair',             '🪑', 119,   { perk: 'chair', comfort: 1 });
I('furniture', 'chair2',   'Gaming chair',             '🪑', 349,   { perk: 'chair', comfort: 2 });
I('furniture', 'chair3',   'Ergonomic chair',          '🪑', 1399,  { perk: 'chair', comfort: 4 });
I('furniture', 'shelf',    'Bookshelf with books',     '📚', 119,   { comfort: 1, fun: 1 });
I('furniture', 'lamp',     'Floor lamp',               '💡', 59,    { comfort: 1 });
I('furniture', 'rug',      'Cozy rug',                 '🟫', 149,   { comfort: 1 });
I('furniture', 'plant',    'House plant',              '🪴', 35,    { comfort: 1, health: 1 });
I('furniture', 'minifridge','Mini fridge',             '🧊', 179,   { perk: 'fridge', comfort: 1 });
I('furniture', 'fridge',   'Smart fridge',             '🧊', 1399,  { perk: 'fridge', comfort: 2 });
I('furniture', 'tv1',      '55" 4K TV',                '📺', 499,   { perk: 'tv', tv: 15 });
I('furniture', 'tv2',      '85" OLED TV',              '📺', 3499,  { perk: 'tv', tv: 24, comfort: 1 });
I('furniture', 'aquarium', 'Aquarium',                 '🐠', 599,   { comfort: 3, fun: 2 });
I('furniture', 'arcade',   'Arcade cabinet',           '👾', 2499,  { perk: 'arcade', comfort: 1 });
I('furniture', 'pool',     'Pool table',               '🎱', 2999,  { perk: 'pool', comfort: 1 });
I('furniture', 'massage',  'Massage chair',            '💆', 3999,  { comfort: 6, health: 1 });
I('furniture', 'hottub',   'Hot tub',                  '♨️', 8999,  { comfort: 8, health: 2 });
I('furniture', 'cinema',   'Home cinema system',       '🎬', 24999, { perk: 'tv', tv: 35, comfort: 5 });
I('furniture', 'piano',    'Grand piano',              '🎹', 34999, { comfort: 6, fun: 4 });
I('furniture', 'gym',      'Home gym',                 '🏋️', 6999,  { perk: 'gym', health: 2 });

// ---------- Vehicles (commute is one-way hours; walking is 1h) ----------
I('vehicles', 'skate',   'Skateboard',              '🛹', 89,      { commute: 0.75, fun: 6,  upkeep: 0,     depr: 0.001 });
I('vehicles', 'bike',    'Bicycle',                 '🚲', 349,     { commute: 0.6,  fun: 6,  upkeep: 2,     depr: 0.001 });
I('vehicles', 'scooter', 'Electric scooter',        '🛴', 599,     { commute: 0.5,  fun: 8,  upkeep: 3,     depr: 0.002 });
I('vehicles', 'moto',    'Motorcycle',              '🏍️', 8999,    { commute: 0.3,  fun: 18, upkeep: 30,    depr: 0.0015, motor: 1 });
I('vehicles', 'hatch',   'Used hatchback (2009)',   '🚗', 4499,    { commute: 0.35, fun: 5,  upkeep: 45,    depr: 0.0008, car: 1 });
I('vehicles', 'sedan',   'Family sedan',            '🚙', 27999,   { commute: 0.3,  fun: 8,  upkeep: 60,    depr: 0.0012, car: 1 });
I('vehicles', 'ev',      'Electric sedan',          '🚘', 41999,   { commute: 0.3,  fun: 14, upkeep: 25,    depr: 0.0012, car: 1 });
I('vehicles', 'truck',   'Pickup truck',            '🛻', 44999,   { commute: 0.3,  fun: 10, upkeep: 80,    depr: 0.001,  car: 1 });
I('vehicles', 'suv',     'Luxury SUV',              '🚙', 84999,   { commute: 0.3,  fun: 16, upkeep: 120,   depr: 0.0015, car: 1 });
I('vehicles', 'sports',  'Sports car',              '🏎️', 119999,  { commute: 0.25, fun: 30, upkeep: 250,   depr: 0.0012, car: 1 });
I('vehicles', 'super',   'Supercar',                '🏎️', 349999,  { commute: 0.25, fun: 45, upkeep: 600,   depr: 0.001,  car: 1 });
I('vehicles', 'hyper',   'Hypercar',                '🏁', 2999999, { commute: 0.2,  fun: 60, upkeep: 3000,  depr: 0.0004, car: 1 });
I('vehicles', 'boat',    'Speedboat',               '🚤', 79999,   { fun: 35, upkeep: 300,   depr: 0.001,  noGarage: 1 });
I('vehicles', 'heli',    'Helicopter',              '🚁', 3499999, { commute: 0.15, fun: 50, upkeep: 8000, depr: 0.0006, noGarage: 1 });
I('vehicles', 'yacht',   'Superyacht',              '🛥️', 4999999, { fun: 70, upkeep: 15000, depr: 0.0005, noGarage: 1 });
I('vehicles', 'jet',     'Private jet',             '🛩️', 24999999,{ fun: 80, upkeep: 40000, depr: 0.0005, noGarage: 1 });

// ---------- Clothing ----------
I('clothing', 'tee',      'Basic T-shirt',          '👕', 15);
I('clothing', 'jeans',    'Jeans',                  '👖', 49);
I('clothing', 'hoodie',   'Hoodie',                 '🧥', 59);
I('clothing', 'sneakers', 'Sneakers',               '👟', 89);
I('clothing', 'suit1',    'Business suit',          '🤵', 449,  { suit: 1, desc: 'Required for office jobs.' });
I('clothing', 'dress',    'Evening dress',          '👗', 699,  { suit: 1, desc: 'Counts as office attire.' });
I('clothing', 'heels',    'Designer heels',         '👠', 1099);
I('clothing', 'jacket',   'Designer leather jacket','🧥', 2799);
I('clothing', 'rare',     'Limited-edition sneakers','👟', 1499, { appr: [-0.004, 0.006] });
I('clothing', 'suit2',    'Tailored designer suit', '🤵', 4999, { suit: 2, desc: 'Executive-level attire.' });

// ---------- Luxury (some go up or down in value) ----------
I('luxury', 'lotto',   'Lottery ticket',          '🎟️', 2,      { cons: 1, lottery: 'lotto', desc: '1 in 5,000 chance of $1,000,000.' });
I('luxury', 'scratch', 'Scratch card',            '🎫', 5,      { cons: 1, lottery: 'scratch', desc: 'Small prizes, sometimes $10,000.' });
I('luxury', 'chain',   'Gold chain',              '📿', 2499,   { appr: [-0.003, 0.004] });
I('luxury', 'card',    'Rare trading card',       '🃏', 7999,   { appr: [-0.02, 0.022] });
I('luxury', 'lwatch',  'Luxury wristwatch',       '⌚', 11999,  { appr: [-0.002, 0.003] });
I('luxury', 'ring',    'Diamond ring',            '💍', 24999,  { appr: [-0.002, 0.0025] });
I('luxury', 'painting','Oil painting',            '🖼️', 39999,  { appr: [-0.006, 0.009] });
I('luxury', 'gold',    '1kg gold bar',            '🥇', 69999,  { appr: [-0.006, 0.0072] });
I('luxury', 'tourb',   'Swiss tourbillon watch',  '⌚', 249999, { appr: [-0.002, 0.0035] });
I('luxury', 'master',  'Old-master painting',     '🖼️', 4999999,{ appr: [-0.006, 0.0085] });

// ---------- Pets ----------
I('pets', 'fish',    'Goldfish',  '🐟', 20,    { petFun: 1, upkeep: 2 });
I('pets', 'hamster', 'Hamster',   '🐹', 40,    { petFun: 2, upkeep: 5 });
I('pets', 'cat',     'Cat',       '🐈', 149,   { petFun: 4, upkeep: 15 });
I('pets', 'dog',     'Dog',       '🐕', 599,   { petFun: 6, upkeep: 25 });
I('pets', 'parrot',  'Parrot',    '🦜', 1199,  { petFun: 5, upkeep: 15 });
I('pets', 'horse',   'Horse',     '🐎', 14999, { petFun: 9, upkeep: 300 });

const ITEM = Object.fromEntries(ITEMS.map(it => [it.id, it]));

const PC_SLOTS = [
  { id: 'cpu',      name: 'CPU',          req: 1 },
  { id: 'gpu',      name: 'Graphics card', req: 1 },
  { id: 'mobo',     name: 'Motherboard',  req: 1 },
  { id: 'ram',      name: 'RAM',          req: 1 },
  { id: 'storage',  name: 'Storage',      req: 1 },
  { id: 'psu',      name: 'Power supply', req: 1 },
  { id: 'case',     name: 'Case',         req: 1 },
  { id: 'monitor',  name: 'Monitor',      req: 1 },
  { id: 'cooler',   name: 'CPU cooler',   req: 0 },
  { id: 'keyboard', name: 'Keyboard',     req: 0 },
  { id: 'mouse',    name: 'Mouse',        req: 0 },
  { id: 'headset',  name: 'Headset',      req: 0 },
];

// rent is weekly; null means it can only be bought. slots = furniture spots.
const HOMES = [
  { id: 'room',      name: 'Shared room',         icon: '🚪', rent: 150,   buy: null,     slots: 4,  garage: 0 },
  { id: 'studio',    name: 'Studio apartment',    icon: '🏢', rent: 350,   buy: null,     slots: 7,  garage: 0 },
  { id: 'apt',       name: '1-bedroom apartment', icon: '🏬', rent: 600,   buy: 240000,   slots: 10, garage: 1 },
  { id: 'house',     name: 'Suburban house',      icon: '🏡', rent: 1200,  buy: 420000,   slots: 16, garage: 2 },
  { id: 'penthouse', name: 'City penthouse',      icon: '🌆', rent: 6500,  buy: 1800000,  slots: 22, garage: 3 },
  { id: 'mansion',   name: 'Mansion',             icon: '🏰', rent: null,  buy: 8500000,  slots: 32, garage: 8 },
  { id: 'island',    name: 'Private island villa',icon: '🏝️', rent: null,  buy: 45000000, slots: 40, garage: 12 },
];
const HOME = Object.fromEntries(HOMES.map(h => [h.id, h]));

// wage is hourly; shifts are 8 hours.
const JOBS = [
  { id: 'none',      name: 'Unemployed',            icon: '🛋️', wage: 0 },
  { id: 'fastfood',  name: 'Fast-food crew',         icon: '🍟', wage: 12 },
  { id: 'cashier',   name: 'Supermarket cashier',    icon: '🧾', wage: 15,  req: { shifts: 5 } },
  { id: 'delivery',  name: 'Delivery rider',         icon: '📦', wage: 18,  req: { vehicle: 1 } },
  { id: 'warehouse', name: 'Warehouse worker',       icon: '🏭', wage: 20,  req: { shifts: 12 } },
  { id: 'rideshare', name: 'Rideshare driver',       icon: '🚕', wage: 26,  req: { car: 1, phone: 1 } },
  { id: 'office',    name: 'Office assistant',       icon: '🗂️', wage: 28,  req: { suit: 1, shifts: 18 } },
  { id: 'itsupport', name: 'IT support technician',  icon: '🛠️', wage: 34,  req: { comp: 10, shifts: 25 } },
  { id: 'juniordev', name: 'Junior developer',       icon: '👩‍💻', wage: 46,  req: { comp: 25, shifts: 40 } },
  { id: 'seniordev', name: 'Senior developer',       icon: '🧑‍💻', wage: 80,  req: { comp: 90, shifts: 75 } },
  { id: 'techlead',  name: 'Tech lead',              icon: '🧠', wage: 120, req: { comp: 140, suit: 1, shifts: 110 } },
  { id: 'director',  name: 'Director',               icon: '📈', wage: 200, req: { suit: 2, status: 150, shifts: 150 } },
  { id: 'ceo',       name: 'CEO',                    icon: '👑', wage: 400, req: { suit: 2, status: 600, car: 1, shifts: 200 } },
];
const JOB = Object.fromEntries(JOBS.map(j => [j.id, j]));

const STOCKS = [
  { sym: 'IDX',  name: 'Total Market Index',   price: 400, vol: 0.01,  drift: 0.0006 },
  { sym: 'NOVA', name: 'Nova Computing',       price: 120, vol: 0.03,  drift: 0.001 },
  { sym: 'GPUX', name: 'GPUX Semiconductors',  price: 85,  vol: 0.045, drift: 0.0015 },
  { sym: 'VOLT', name: 'Volt Motors',          price: 210, vol: 0.04,  drift: 0.0007 },
  { sym: 'BRGR', name: 'Burger Planet',        price: 45,  vol: 0.015, drift: 0.0004 },
  { sym: 'MOON', name: 'MoonCoin (crypto)',    price: 2.5, vol: 0.1,   drift: 0.0015 },
];

const ACHIEVEMENTS = [
  { id: 'first_buy',  icon: '🛍️', name: 'First purchase',     desc: 'Buy anything.' },
  { id: 'first_job',  icon: '💼', name: 'Employed',           desc: 'Get a job.' },
  { id: 'week1',      icon: '📅', name: 'First week',         desc: 'Survive 7 days.' },
  { id: 'month1',     icon: '🗓️', name: 'One month in',       desc: 'Reach day 30.' },
  { id: 'bed',        icon: '🛏️', name: 'Off the floor',      desc: 'Buy a bed.' },
  { id: 'pc_built',   icon: '🖥️', name: 'PC builder',         desc: 'Build a working PC.' },
  { id: 'pc_beast',   icon: '🔥', name: 'Absolute beast',     desc: 'Reach a PC score of 170.' },
  { id: 'gpu_top',    icon: '🎮', name: 'Top of the line',    desc: 'Own a flagship graphics card or better.' },
  { id: 'first_car',  icon: '🚗', name: 'Licensed',           desc: 'Buy a car.' },
  { id: 'supercar',   icon: '🏎️', name: 'Need for speed',     desc: 'Own a supercar or hypercar.' },
  { id: 'fleet',      icon: '🚘', name: 'Fleet',              desc: 'Own 5 vehicles at once.' },
  { id: 'furnished',  icon: '🛋️', name: 'Fully furnished',    desc: 'Have 10 pieces of furniture placed.' },
  { id: 'homeowner',  icon: '🏡', name: 'Homeowner',          desc: 'Buy a home.' },
  { id: 'mansion',    icon: '🏰', name: 'Living large',       desc: 'Own the mansion.' },
  { id: 'island',     icon: '🏝️', name: 'Island life',        desc: 'Own a private island.' },
  { id: 'pets3',      icon: '🐾', name: 'Zookeeper',          desc: 'Own 3 pets.' },
  { id: 'foodie',     icon: '🍽️', name: 'Foodie',             desc: 'Eat or drink 100 things.' },
  { id: 'lucky',      icon: '🍀', name: 'Lucky',              desc: 'Win $1,000 or more from a ticket.' },
  { id: 'streamer',   icon: '🎙️', name: 'Influencer',         desc: 'Reach 10,000 followers.' },
  { id: 'investor',   icon: '📈', name: 'Investor',           desc: 'Own $10,000 of stock.' },
  { id: 'ceo',        icon: '👑', name: 'Corner office',      desc: 'Become CEO.' },
  { id: 'yacht',      icon: '🛥️', name: 'Set sail',           desc: 'Own a superyacht.' },
  { id: 'jet',        icon: '🛩️', name: 'Jet set',            desc: 'Own a private jet.' },
  { id: 'nw10k',      icon: '💵', name: 'Getting started',    desc: 'Net worth of $10,000.' },
  { id: 'nw100k',     icon: '💰', name: 'Six figures',        desc: 'Net worth of $100,000.' },
  { id: 'nw1m',       icon: '🤑', name: 'Millionaire',        desc: 'Net worth of $1,000,000.' },
  { id: 'nw1b',       icon: '🏦', name: 'Billionaire',        desc: 'Net worth of $1,000,000,000.' },
  { id: 'collector',  icon: '🏆', name: 'Buy it all',         desc: 'Own every kind of item at least once.' },
  { id: 'hospital',   icon: '🚑', name: 'Oops',               desc: 'End up in hospital.' },
];
