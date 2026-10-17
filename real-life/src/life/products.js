// Product catalog: everything the hometown stores sell (master list §12-15). Prices are real
// 2026 Ohio prices; brands are parodies (§13). Every product is a real 3D thing you can hold.
//
// Fields:
//   id, name, brand, price, store ('grocery' | 'electronics' | 'furniture'), aisle
//   pack: how it looks -> { shape: 'box'|'bag'|'bottle'|'can'|'jug'|'carton'|'jar'|'tray'|'model',
//          size: [w, h, d] metres, colors: [main, accent], kit/model for 'model' }
//   food: { hunger, thirst, energy, fun, junk, servings, minutes } (needs restored per serving)
//   taxed: true for non-food items (Ohio doesn't tax food for home use)
//   age: minimum age to buy (cashiers ask for ID)
//   big: furniture that has to be delivered (too big to carry home)

export const TAX_RATE = 0.0725; // Ohio 5.75% + county 1.5%

const P = [];
const add = (store, aisle, list) => {
  for (const p of list) P.push({ store, aisle, taxed: store !== 'grocery' || !!p.taxed, ...p });
};

// ------------------------------------------------------------------------------------- grocery
add('grocery', 'Produce', [
  { id: 'banana', name: 'Banana', brand: '', price: 0.29, pack: { shape: 'model', kit: 'food', model: 'banana', size: [0.2, 0.05, 0.05] }, food: { hunger: 0.12, energy: 0.05, servings: 1, minutes: 3 }, unit: 'each' },
  { id: 'apple', name: 'Gala Apple', brand: '', price: 0.79, pack: { shape: 'model', kit: 'food', model: 'apple', size: [0.08, 0.08, 0.08] }, food: { hunger: 0.1, thirst: 0.03, servings: 1, minutes: 3 }, unit: 'each' },
  { id: 'orange', name: 'Navel Orange', brand: '', price: 0.99, pack: { shape: 'model', kit: 'food', model: 'orange', size: [0.08, 0.08, 0.08] }, food: { hunger: 0.08, thirst: 0.06, servings: 1, minutes: 4 }, unit: 'each' },
  { id: 'lemon', name: 'Lemon', brand: '', price: 0.69, pack: { shape: 'model', kit: 'food', model: 'lemon', size: [0.07, 0.06, 0.06] }, food: { hunger: 0.01, servings: 1, minutes: 1 }, unit: 'each', lemonade: 'lemons' },
  { id: 'tomato', name: 'Tomato', brand: '', price: 0.89, pack: { shape: 'model', kit: 'food', model: 'tomato', size: [0.07, 0.06, 0.07] }, food: { hunger: 0.04, servings: 1, minutes: 2 }, unit: 'each' },
  { id: 'carrot', name: 'Carrots (2 lb)', brand: 'Grimmway', price: 2.49, pack: { shape: 'bag', size: [0.16, 0.26, 0.06], colors: ['#ff8a1f', '#2f7d32'] }, food: { hunger: 0.06, servings: 8, minutes: 2 } },
  { id: 'broccoli', name: 'Broccoli Crown', brand: '', price: 1.99, pack: { shape: 'model', kit: 'food', model: 'broccoli', size: [0.12, 0.13, 0.12] }, food: { hunger: 0.08, servings: 3, minutes: 4 } },
  { id: 'watermelon', name: 'Watermelon', brand: '', price: 5.99, pack: { shape: 'model', kit: 'food', model: 'watermelon', size: [0.32, 0.26, 0.26] }, food: { hunger: 0.06, thirst: 0.12, servings: 10, minutes: 4 }, unit: 'each' },
  { id: 'grapes', name: 'Red Grapes (2 lb)', brand: '', price: 4.49, pack: { shape: 'model', kit: 'food', model: 'grapes', size: [0.12, 0.14, 0.1] }, food: { hunger: 0.06, thirst: 0.04, servings: 6, minutes: 3 } },
  { id: 'onion', name: 'Yellow Onion', brand: '', price: 0.79, pack: { shape: 'model', kit: 'food', model: 'onion', size: [0.08, 0.08, 0.08] }, food: { hunger: 0.02, servings: 2, minutes: 2 }, unit: 'each' },
]);
add('grocery', 'Bakery', [
  { id: 'bread', name: 'White Bread', brand: 'Wunder', price: 2.99, pack: { shape: 'bag', size: [0.12, 0.13, 0.3], colors: ['#f5f1e6', '#d6302e'], print: 'bread' }, food: { hunger: 0.08, servings: 20, minutes: 2 } },
  { id: 'donuts', name: 'Glazed Donuts (12)', brand: 'Krispy Krim', price: 10.99, pack: { shape: 'box', size: [0.3, 0.08, 0.3], colors: ['#2e7a3c', '#d61f2c'] }, food: { hunger: 0.14, energy: 0.06, fun: 0.08, junk: 1, servings: 12, minutes: 3 } },
  { id: 'muffins', name: 'Blueberry Muffins (4)', brand: 'Bakehouse', price: 4.99, pack: { shape: 'tray', size: [0.22, 0.09, 0.15], colors: ['#f2e2c4', '#3a4fa0'] }, food: { hunger: 0.15, junk: 0.6, servings: 4, minutes: 4 } },
  { id: 'cake', name: 'Birthday Cake', brand: 'Bakehouse', price: 19.99, pack: { shape: 'model', kit: 'food', model: 'cake-birthday', size: [0.26, 0.11, 0.26] }, food: { hunger: 0.12, fun: 0.12, junk: 1, servings: 12, minutes: 4 } },
]);
add('grocery', 'Dairy', [
  { id: 'milk', name: 'Whole Milk (1 gal)', brand: 'Hilltop Farms', price: 3.89, pack: { shape: 'jug', size: [0.15, 0.25, 0.15], colors: ['#f7f7f2', '#d12e2e'] }, food: { hunger: 0.05, thirst: 0.18, servings: 16, minutes: 1 } },
  { id: 'choc-milk', name: 'Chocolate Milk (half gal)', brand: 'Hilltop Farms', price: 3.29, pack: { shape: 'carton', size: [0.09, 0.24, 0.09], colors: ['#6b3b1f', '#f2e3c6'] }, food: { hunger: 0.05, thirst: 0.16, fun: 0.04, junk: 0.4, servings: 8, minutes: 1 } },
  { id: 'eggs', name: 'Large Eggs (12)', brand: 'Hilltop Farms', price: 3.49, pack: { shape: 'box', size: [0.3, 0.07, 0.11], colors: ['#d9c7a5', '#2f6b3a'] }, food: { hunger: 0.14, servings: 6, minutes: 6, cook: true } },
  { id: 'cheese', name: 'Cheddar Slices', brand: 'Kraff', price: 3.79, pack: { shape: 'tray', size: [0.11, 0.03, 0.11], colors: ['#f2a71b', '#1f4ea0'] }, food: { hunger: 0.06, servings: 12, minutes: 1 } },
  { id: 'yogurt', name: 'Strawberry Yogurt', brand: 'Yoplay', price: 0.89, pack: { shape: 'jar', size: [0.065, 0.08, 0.065], colors: ['#ef5b8a', '#ffffff'] }, food: { hunger: 0.07, servings: 1, minutes: 2 } },
  { id: 'butter', name: 'Butter (4 sticks)', brand: "Land O' Lakez", price: 4.99, pack: { shape: 'box', size: [0.13, 0.065, 0.065], colors: ['#f6e7a6', '#3a6ea5'] }, food: { hunger: 0.02, servings: 32, minutes: 1 } },
]);
add('grocery', 'Frozen', [
  { id: 'pizza-frozen', name: 'Pepperoni Pizza (frozen)', brand: 'DiGordo', price: 6.49, pack: { shape: 'box', size: [0.3, 0.05, 0.3], colors: ['#c9181e', '#1d1d1d'] }, food: { hunger: 0.22, junk: 0.9, fun: 0.04, servings: 4, minutes: 5, cook: true } },
  { id: 'nuggets', name: 'Chicken Nuggets', brand: 'Tysun', price: 8.99, pack: { shape: 'bag', size: [0.24, 0.32, 0.06], colors: ['#ffb41f', '#5a2a12'] }, food: { hunger: 0.2, junk: 0.8, servings: 5, minutes: 5, cook: true } },
  { id: 'ice-cream', name: 'Vanilla Ice Cream', brand: "Ben & Jeri's", price: 5.49, pack: { shape: 'jar', size: [0.12, 0.1, 0.12], colors: ['#f2ead6', '#3b6bbd'] }, food: { hunger: 0.06, fun: 0.1, junk: 1, servings: 4, minutes: 3 } },
  { id: 'popsicles', name: 'Ice Pops (12)', brand: 'Popsicul', price: 3.99, pack: { shape: 'box', size: [0.2, 0.05, 0.14], colors: ['#ff4f6d', '#3ab7ff'] }, food: { thirst: 0.06, fun: 0.08, junk: 0.8, servings: 12, minutes: 2 } },
  { id: 'microwave-meal', name: 'Mac & Cheese Bowl', brand: 'Stoufer', price: 3.29, pack: { shape: 'box', size: [0.16, 0.05, 0.12], colors: ['#f4c542', '#c0392b'] }, food: { hunger: 0.25, junk: 0.5, servings: 1, minutes: 5, cook: true } },
]);
add('grocery', 'Snacks', [
  { id: 'chips-doritoz', name: 'Nacho Cheese Chips', brand: 'Doritoz', price: 5.29, pack: { shape: 'bag', size: [0.24, 0.32, 0.07], colors: ['#d7261e', '#f4b400'] }, food: { hunger: 0.08, fun: 0.06, junk: 1, servings: 6, minutes: 3 } },
  { id: 'chips-leys', name: 'Classic Potato Chips', brand: 'Leys', price: 4.99, pack: { shape: 'bag', size: [0.24, 0.32, 0.07], colors: ['#ffd400', '#d81e1e'] }, food: { hunger: 0.07, fun: 0.05, junk: 1, servings: 6, minutes: 3 } },
  { id: 'chips-cheetoz', name: 'Crunchy Cheese Puffs', brand: 'Cheetoz', price: 4.99, pack: { shape: 'bag', size: [0.24, 0.32, 0.07], colors: ['#f57c00', '#2b6dd6'] }, food: { hunger: 0.07, fun: 0.06, junk: 1, servings: 6, minutes: 3 } },
  { id: 'pringels', name: 'Original Crisps (can)', brand: 'Pringels', price: 2.79, pack: { shape: 'can', size: [0.075, 0.25, 0.075], colors: ['#c8102e', '#ffffff'] }, food: { hunger: 0.07, fun: 0.05, junk: 1, servings: 5, minutes: 3 } },
  { id: 'oreoz', name: 'Chocolate Sandwich Cookies', brand: 'Oreoz', price: 4.79, pack: { shape: 'box', size: [0.2, 0.06, 0.08], colors: ['#1b4fae', '#ffffff'] }, food: { hunger: 0.06, fun: 0.06, junk: 1, servings: 10, minutes: 2 } },
  { id: 'gummies', name: 'Gummy Bears', brand: 'Haribu', price: 2.29, pack: { shape: 'bag', size: [0.13, 0.18, 0.04], colors: ['#ffd400', '#e30613'] }, food: { hunger: 0.03, fun: 0.07, junk: 1, servings: 4, minutes: 2 } },
  { id: 'snikkers', name: 'Chocolate Bar', brand: 'Snikkers', price: 1.89, pack: { shape: 'bag', size: [0.13, 0.03, 0.04], colors: ['#5a3519', '#1f5fbf'] }, food: { hunger: 0.08, energy: 0.04, fun: 0.05, junk: 1, servings: 1, minutes: 2 } },
  { id: 'skitlez', name: 'Fruit Chews', brand: 'Skitlez', price: 1.79, pack: { shape: 'bag', size: [0.09, 0.13, 0.02], colors: ['#d4101b', '#ffffff'] }, food: { hunger: 0.03, fun: 0.06, junk: 1, servings: 1, minutes: 2 } },
  { id: 'gum', name: 'Mint Gum', brand: 'Extraa', price: 1.79, pack: { shape: 'box', size: [0.08, 0.06, 0.02], colors: ['#1e8a5a', '#ffffff'] }, food: { fun: 0.02, servings: 15, minutes: 1 } },
  { id: 'popcorn', name: 'Microwave Popcorn (3)', brand: 'Orvil', price: 3.99, pack: { shape: 'box', size: [0.16, 0.12, 0.06], colors: ['#ffd23f', '#c62828'] }, food: { hunger: 0.06, fun: 0.06, junk: 0.6, servings: 3, minutes: 3, cook: true } },
  { id: 'granola', name: 'Granola Bars (6)', brand: 'Natur Valley', price: 4.29, pack: { shape: 'box', size: [0.2, 0.07, 0.06], colors: ['#2e7d32', '#f9e1b5'] }, food: { hunger: 0.09, energy: 0.03, servings: 6, minutes: 2 } },
]);
add('grocery', 'Cereal & Breakfast', [
  { id: 'cereal-frosted', name: 'Frosted Flakes', brand: "Kelloggz", price: 4.79, pack: { shape: 'box', size: [0.2, 0.29, 0.07], colors: ['#1f6fd1', '#ff8c1a'] }, food: { hunger: 0.15, junk: 0.6, servings: 10, minutes: 4, needsMilk: true } },
  { id: 'cereal-loops', name: 'Froot Loopz', brand: "Kelloggz", price: 4.99, pack: { shape: 'box', size: [0.2, 0.29, 0.07], colors: ['#e2231a', '#ffde00'] }, food: { hunger: 0.14, fun: 0.04, junk: 0.8, servings: 10, minutes: 4, needsMilk: true } },
  { id: 'cereal-oats', name: 'Honey Oat Cheerios', brand: 'Cheeri-Ohs', price: 4.59, pack: { shape: 'box', size: [0.2, 0.29, 0.07], colors: ['#f5c400', '#7a4b1c'] }, food: { hunger: 0.15, servings: 12, minutes: 4, needsMilk: true } },
  { id: 'pancake-mix', name: 'Pancake Mix', brand: 'Aunt Janie', price: 3.69, pack: { shape: 'box', size: [0.18, 0.25, 0.06], colors: ['#c8102e', '#f6d38a'] }, food: { hunger: 0.18, servings: 8, minutes: 8, cook: true } },
  { id: 'peanut-butter', name: 'Creamy Peanut Butter', brand: 'Jiffi', price: 3.49, pack: { shape: 'jar', size: [0.09, 0.13, 0.09], colors: ['#7a4a1f', '#1f5fbf'] }, food: { hunger: 0.06, servings: 15, minutes: 1 } },
]);
add('grocery', 'Drinks', [
  { id: 'water-bottle', name: 'Spring Water (16.9 oz)', brand: 'Aquafeena', price: 1.29, pack: { shape: 'bottle', size: [0.065, 0.21, 0.065], colors: ['#d8eef8', '#1f6fd1'], clear: true }, food: { thirst: 0.25, servings: 1, minutes: 1 } },
  { id: 'water-case', name: 'Spring Water (24 pack)', brand: 'Aquafeena', price: 5.99, pack: { shape: 'box', size: [0.4, 0.21, 0.27], colors: ['#d8eef8', '#1f6fd1'] }, food: { thirst: 0.25, servings: 24, minutes: 1 } },
  { id: 'pepsy-2l', name: 'Pepsy (2 L)', brand: 'Pepsy', price: 2.79, pack: { shape: 'bottle', size: [0.11, 0.32, 0.11], colors: ['#0b3b8c', '#e1251b'] }, food: { thirst: 0.16, energy: 0.04, junk: 1, servings: 8, minutes: 1 } },
  { id: 'koka-can', name: 'Koka-Kola (12 oz can)', brand: 'Koka-Kola', price: 1.49, pack: { shape: 'can', size: [0.066, 0.122, 0.066], colors: ['#e2001a', '#ffffff'] }, food: { thirst: 0.2, energy: 0.05, junk: 1, servings: 1, minutes: 1 } },
  { id: 'koka-12', name: 'Koka-Kola (12 pack)', brand: 'Koka-Kola', price: 7.99, pack: { shape: 'box', size: [0.4, 0.13, 0.14], colors: ['#e2001a', '#ffffff'] }, food: { thirst: 0.2, energy: 0.05, junk: 1, servings: 12, minutes: 1 } },
  { id: 'mtn-doo', name: 'Mountain Doo (20 oz)', brand: 'Mountain Doo', price: 2.39, pack: { shape: 'bottle', size: [0.075, 0.24, 0.075], colors: ['#3fae2a', '#e8f31c'] }, food: { thirst: 0.2, energy: 0.08, junk: 1, servings: 1, minutes: 1 } },
  { id: 'sprit', name: 'Sprit Lemon-Lime (20 oz)', brand: 'Sprit', price: 2.29, pack: { shape: 'bottle', size: [0.075, 0.24, 0.075], colors: ['#0a8f3c', '#f5d90a'] }, food: { thirst: 0.22, junk: 1, servings: 1, minutes: 1 } },
  { id: 'gatorayd', name: 'Sports Drink (28 oz)', brand: 'Gatorayd', price: 2.19, pack: { shape: 'bottle', size: [0.08, 0.25, 0.08], colors: ['#ff7a00', '#1b1b1b'] }, food: { thirst: 0.28, energy: 0.04, servings: 1, minutes: 1 } },
  { id: 'oj', name: 'Orange Juice (52 oz)', brand: 'Tropicanna', price: 4.29, pack: { shape: 'carton', size: [0.095, 0.25, 0.095], colors: ['#ff9e1b', '#1d7a2f'] }, food: { thirst: 0.2, hunger: 0.03, servings: 6, minutes: 1 } },
  { id: 'apple-juice', name: 'Apple Juice Boxes (8)', brand: 'Jucy Jooce', price: 3.99, pack: { shape: 'box', size: [0.2, 0.11, 0.1], colors: ['#c4161c', '#ffd23f'] }, food: { thirst: 0.18, servings: 8, minutes: 1 } },
  { id: 'red-ball', name: 'Energy Drink (8.4 oz)', brand: 'Red Ball', price: 2.99, pack: { shape: 'can', size: [0.053, 0.135, 0.053], colors: ['#1d3c8f', '#c0c4cc'] }, food: { thirst: 0.1, energy: 0.3, junk: 1, servings: 1, minutes: 1, caffeine: 1 }, age: 0 },
  { id: 'monstar', name: 'Monstar Energy (16 oz)', brand: 'Monstar', price: 3.29, pack: { shape: 'can', size: [0.066, 0.168, 0.066], colors: ['#151515', '#7ed321'] }, food: { thirst: 0.12, energy: 0.35, junk: 1, servings: 1, minutes: 1, caffeine: 1.5 } },
  { id: 'lemonade-mix', name: 'Lemonade Mix', brand: 'Kountry Time', price: 4.49, pack: { shape: 'jar', size: [0.11, 0.17, 0.11], colors: ['#ffe14d', '#e2231a'] }, lemonade: 'mix' },
  { id: 'sugar', name: 'Sugar (4 lb)', brand: 'Dominoh', price: 3.99, pack: { shape: 'bag', size: [0.16, 0.24, 0.08], colors: ['#ffffff', '#1f4ea0'] }, lemonade: 'sugar' },
  { id: 'cups', name: 'Plastic Cups (50)', brand: 'Sola', price: 3.49, pack: { shape: 'bag', size: [0.1, 0.28, 0.1], colors: ['#d6302e', '#ffffff'] }, lemonade: 'cups', taxed: true },
  { id: 'ice', name: 'Bag of Ice (7 lb)', brand: 'Arctic', price: 2.99, pack: { shape: 'bag', size: [0.28, 0.4, 0.12], colors: ['#d8eef8', '#1f6fd1'] }, lemonade: 'ice' },
  { id: 'beer-12', name: 'Lite Beer (12 pack)', brand: 'Bud Lyte', price: 13.99, pack: { shape: 'box', size: [0.4, 0.13, 0.14], colors: ['#1f4ea0', '#ffffff'] }, food: { thirst: 0.08, alcohol: 1, servings: 12, minutes: 1 }, age: 21, taxed: true },
]);
add('grocery', 'Household', [
  { id: 'paper-towels', name: 'Paper Towels (6)', brand: 'Bountee', price: 9.99, pack: { shape: 'bag', size: [0.3, 0.28, 0.2], colors: ['#ffffff', '#1f6fd1'] } },
  { id: 'toilet-paper', name: 'Toilet Paper (12)', brand: 'Charmen', price: 11.49, pack: { shape: 'bag', size: [0.4, 0.24, 0.3], colors: ['#ffffff', '#3b6bbd'] } },
  { id: 'toothpaste', name: 'Toothpaste', brand: 'Kolgate', price: 3.29, pack: { shape: 'box', size: [0.2, 0.05, 0.04], colors: ['#d6302e', '#ffffff'] }, hygiene: 'teeth' },
  { id: 'deodorant', name: 'Deodorant', brand: 'Ax', price: 6.49, pack: { shape: 'jar', size: [0.05, 0.14, 0.05], colors: ['#111111', '#ff6b00'] }, hygiene: 'deodorant' },
  { id: 'soap', name: 'Bar Soap (3)', brand: 'Dov', price: 4.99, pack: { shape: 'box', size: [0.16, 0.05, 0.09], colors: ['#ffffff', '#1c3f8c'] } },
  { id: 'trash-bags', name: 'Trash Bags (40)', brand: 'Hefti', price: 8.99, pack: { shape: 'box', size: [0.24, 0.14, 0.12], colors: ['#1d1d1d', '#f4a300'] } },
  { id: 'batteries', name: 'AA Batteries (8)', brand: 'Duracel', price: 9.49, pack: { shape: 'box', size: [0.12, 0.17, 0.03], colors: ['#111111', '#c88a2b'] } },
]);

// --------------------------------------------------------------------------------- electronics
add('electronics', 'TVs', [
  { id: 'tv-32', name: '32" HD Smart TV', brand: 'Insygnia', price: 99.99, pack: { shape: 'box', size: [0.8, 0.52, 0.12], colors: ['#1d1d1d', '#2f7dd1'] }, big: true },
  { id: 'tv-55', name: '55" 4K Smart TV', brand: 'Samsong', price: 379.99, pack: { shape: 'box', size: [1.35, 0.85, 0.15], colors: ['#0d0d0d', '#1f4ea0'] }, big: true },
  { id: 'tv-75', name: '75" 4K QLED TV', brand: 'Samsong', price: 899.99, pack: { shape: 'box', size: [1.8, 1.1, 0.18], colors: ['#0d0d0d', '#6a1fbf'] }, big: true },
]);
add('electronics', 'Gaming', [
  { id: 'ps5', name: 'PlayStashun 5 Slim', brand: 'Sonee', price: 499.99, pack: { shape: 'box', size: [0.42, 0.12, 0.33], colors: ['#ffffff', '#003791'] }, locked: true },
  { id: 'xbox', name: 'Xbocks Series Z', brand: 'Microsofd', price: 499.99, pack: { shape: 'box', size: [0.2, 0.36, 0.2], colors: ['#111111', '#107c10'] }, locked: true },
  { id: 'swotch', name: 'Nintendoh Swotch 2', brand: 'Nintendoh', price: 449.99, pack: { shape: 'box', size: [0.33, 0.12, 0.12], colors: ['#e60012', '#00b4dc'] }, locked: true },
  { id: 'controller', name: 'Wireless Controller', brand: 'Sonee', price: 74.99, pack: { shape: 'box', size: [0.18, 0.22, 0.07], colors: ['#ffffff', '#003791'] } },
  { id: 'game-blasto', name: 'Super Blasto 3 (game)', brand: 'Nintendoh', price: 69.99, pack: { shape: 'box', size: [0.105, 0.17, 0.015], colors: ['#d6336c', '#ffe14d'] } },
  { id: 'game-racer', name: 'Turbo Kart Racer (game)', brand: 'Nintendoh', price: 59.99, pack: { shape: 'box', size: [0.105, 0.17, 0.015], colors: ['#e60012', '#ffffff'] } },
  { id: 'game-craft', name: 'BlockCraft (game)', brand: 'Mojeng', price: 29.99, pack: { shape: 'box', size: [0.105, 0.17, 0.015], colors: ['#5d8c2f', '#7a5230'] } },
  { id: 'gift-card', name: 'PlayStashun Store Card $25', brand: 'Sonee', price: 25, pack: { shape: 'box', size: [0.09, 0.14, 0.005], colors: ['#003791', '#ffffff'] } },
]);
add('electronics', 'PC Parts', [
  { id: 'gpu-4060', name: 'GeFarce RTX 5060', brand: 'NVIDEO', price: 299.99, pack: { shape: 'box', size: [0.3, 0.14, 0.08], colors: ['#76b900', '#111111'] }, locked: true, pc: 'gpu' },
  { id: 'gpu-4080', name: 'GeFarce RTX 5080', brand: 'NVIDEO', price: 1099.99, pack: { shape: 'box', size: [0.38, 0.17, 0.1], colors: ['#76b900', '#111111'] }, locked: true, pc: 'gpu' },
  { id: 'gpu-rx', name: 'Radeyon RX 9070', brand: 'ADM', price: 549.99, pack: { shape: 'box', size: [0.34, 0.15, 0.09], colors: ['#ed1c24', '#111111'] }, locked: true, pc: 'gpu' },
  { id: 'cpu-intol', name: 'Intol Core i5', brand: 'Intol', price: 189.99, pack: { shape: 'box', size: [0.12, 0.12, 0.08], colors: ['#0071c5', '#ffffff'] }, locked: true, pc: 'cpu' },
  { id: 'cpu-ryzon', name: 'Ryzon 7 9700X', brand: 'ADM', price: 329.99, pack: { shape: 'box', size: [0.12, 0.12, 0.08], colors: ['#ff7a00', '#111111'] }, locked: true, pc: 'cpu' },
  { id: 'ram-32', name: '32GB DDR5 RAM', brand: 'Korsair', price: 94.99, pack: { shape: 'box', size: [0.15, 0.2, 0.03], colors: ['#111111', '#ffd400'] }, pc: 'ram' },
  { id: 'ssd-1tb', name: '1TB NVMe SSD', brand: 'Samsong', price: 79.99, pack: { shape: 'box', size: [0.1, 0.15, 0.02], colors: ['#111111', '#5f8fd6'] }, pc: 'ssd' },
  { id: 'psu-750', name: '750W Power Supply', brand: 'EVGAh', price: 99.99, pack: { shape: 'box', size: [0.2, 0.11, 0.23], colors: ['#111111', '#d61f2c'] }, pc: 'psu' },
  { id: 'pc-case', name: 'Mid Tower Case', brand: 'NZXZ', price: 109.99, pack: { shape: 'box', size: [0.26, 0.52, 0.5], colors: ['#ffffff', '#6a1fbf'] }, pc: 'case' },
]);
add('electronics', 'Computers', [
  { id: 'laptop', name: '15" Laptop', brand: 'Dall', price: 549.99, pack: { shape: 'box', size: [0.42, 0.3, 0.08], colors: ['#111111', '#0076ce'] }, locked: true },
  { id: 'tablet', name: 'iPadd 10th Gen', brand: 'Pear', price: 349.99, pack: { shape: 'box', size: [0.27, 0.2, 0.04], colors: ['#ffffff', '#cccccc'] }, locked: true },
  { id: 'monitor', name: '27" Gaming Monitor', brand: 'ASUZ', price: 229.99, pack: { shape: 'box', size: [0.68, 0.45, 0.14], colors: ['#111111', '#00a3e0'] }, big: true },
  { id: 'keyboard', name: 'RGB Gaming Keyboard', brand: 'Razor', price: 69.99, pack: { shape: 'box', size: [0.46, 0.17, 0.05], colors: ['#111111', '#44d62c'] } },
  { id: 'mouse', name: 'Gaming Mouse', brand: 'Logitek', price: 39.99, pack: { shape: 'box', size: [0.12, 0.17, 0.07], colors: ['#111111', '#00b8fc'] } },
]);
add('electronics', 'Phones & Audio', [
  { id: 'ifone', name: 'iFone 17', brand: 'Pear', price: 799.99, pack: { shape: 'box', size: [0.09, 0.17, 0.04], colors: ['#ffffff', '#111111'] }, locked: true },
  { id: 'galaxie', name: 'Galaxie S26', brand: 'Samsong', price: 749.99, pack: { shape: 'box', size: [0.09, 0.17, 0.04], colors: ['#111111', '#1428a0'] }, locked: true },
  { id: 'prepaid-phone', name: 'Prepaid Phone', brand: 'Trakfone', price: 49.99, pack: { shape: 'box', size: [0.12, 0.18, 0.05], colors: ['#ffffff', '#00a651'] } },
  { id: 'earbuds', name: 'Wireless Earbuds', brand: 'Pear', price: 129.99, pack: { shape: 'box', size: [0.1, 0.1, 0.05], colors: ['#ffffff', '#cccccc'] }, locked: true },
  { id: 'headphones', name: 'Kids Headphones', brand: 'JBEL', price: 19.99, pack: { shape: 'box', size: [0.17, 0.2, 0.07], colors: ['#ff6b9a', '#ffffff'] } },
  { id: 'speaker', name: 'Bluetooth Speaker', brand: 'JBEL', price: 49.99, pack: { shape: 'box', size: [0.2, 0.12, 0.1], colors: ['#ff6b00', '#111111'] } },
  { id: 'charger', name: 'USB-C Charger', brand: 'Ankr', price: 19.99, pack: { shape: 'box', size: [0.08, 0.14, 0.03], colors: ['#ffffff', '#00a0e9'] } },
]);

// ----------------------------------------------------------------------------------- furniture
const F = (id, name, price, model, size, extra = {}) => ({ id, name, brand: 'IKEO', price, pack: { shape: 'model', kit: extra.kit || 'home', model, size }, big: true, furniture: true, ...extra });
add('furniture', 'Bedroom', [
  F('bed-single', 'MALMÖ Single Bed', 199, 'Bed_Single', [1.0, 0.68, 1.97]),
  F('bed-bunk', 'KRÄKA Bunk Bed', 279, 'Bed_Bunk', [1.08, 1.52, 2.0]),
  F('bed-king', 'HEMNÄS King Bed', 449, 'Bed_King', [1.53, 0.61, 1.98]),
  F('nightstand', 'TARVÄ Nightstand', 39.99, 'NightStand_1', [0.48, 0.41, 0.48], { big: false }),
  F('dresser', 'MALMÖ 4-Drawer Dresser', 149, 'Drawer_4', [1.4, 1.03, 0.56]),
  F('dresser-low', 'HEMNÄS Low Dresser', 119, 'Drawer_1', [1.4, 0.68, 0.56]),
]);
add('furniture', 'Living Room', [
  F('sofa-small', 'KLIPPA Loveseat', 249, 'Couch_Small1', [1.44, 0.95, 1.1]),
  F('sofa', 'EKTORPA 3-Seat Sofa', 499, 'Couch_Medium1', [2.34, 0.95, 1.1]),
  F('sofa-l', 'FRIHETEN Corner Sofa', 799, 'Couch_L', [2.8, 1.1, 2.16]),
  F('armchair', 'POÄNGA Armchair', 129, 'Couch_Small2', [1.06, 0.63, 1.0]),
  F('bookshelf', 'BILLIE Bookcase', 69.99, 'Bookshelf', [1.16, 2.22, 0.38]),
  F('shelf-small', 'LACKA Wall Shelf', 14.99, 'Shelf_Small1', [0.97, 0.29, 0.28], { big: false }),
  F('coffee-table', 'LACKA Coffee Table', 49.99, 'Table_RoundSmall', [0.97, 0.57, 0.97]),
  F('rug-round', 'STOCKHOLMA Round Rug', 59.99, 'Carpet_Round', [1.25, 0.01, 1.27], { big: false }),
  F('rug', 'LOHALS Rug 5x8', 89.99, 'Carpet_1', [1.07, 0.02, 1.55], { big: false }),
]);
add('furniture', 'Lighting & Decor', [
  F('floor-lamp', 'HEKTOR Floor Lamp', 39.99, 'Light_Floor1', [0.14, 0.8, 0.15], { big: false }),
  F('desk-lamp', 'TERTIAL Desk Lamp', 14.99, 'Light_Desk', [0.13, 0.29, 0.23], { big: false }),
  F('plant-big', 'FEJKA Big Plant', 34.99, 'Houseplant_8', [0.26, 0.78, 0.26], { big: false }),
  F('plant-small', 'FEJKA Small Plant', 9.99, 'Houseplant_3', [0.17, 0.42, 0.17], { big: false }),
  F('curtains', 'MERITA Curtains', 29.99, 'Curtains_Double', [1.73, 2.17, 0.24], { big: false }),
]);
add('furniture', 'Desks & Chairs', [
  F('desk', 'MICKE Desk', 89.99, 'desk', [1.47, 0.77, 0.78], { kit: 'furniture' }),
  F('gaming-chair', 'UTESPELARE Gaming Chair', 229, 'chairDesk', [0.67, 1.22, 0.63], { kit: 'furniture' }),
  F('chair', 'IVARA Chair', 29.99, 'Chair_1', [0.38, 0.88, 0.41], { big: false }),
  F('stool', 'FROSTA Stool', 9.99, 'Stool', [0.34, 0.69, 0.36], { big: false }),
]);

export const PRODUCTS = P;
export const PRODUCT = Object.fromEntries(P.map((p) => [p.id, p]));
export const byStore = (store) => P.filter((p) => p.store === store);

export function priceText(n) {
  return `$${n.toFixed(2)}`;
}
