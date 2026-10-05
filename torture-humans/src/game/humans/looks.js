// Townspeople looks (Rocketbox avatars converted for the game; see tools/avatars.txt).
// Jobs match the town's buildings; the game falls back to a default look if one is missing.
export const TOWN_LOOKS = [
  'Police_Female_01', 'Police_Male_01', 'Fire_Female_01', 'Fire_Male_01', 'Medical_Female_01', 'Medical_Male_01',
  'Chef_Female_01', 'Business_Female_01', 'Business_Female_03', 'Business_Male_01', 'Business_Male_04',
  'Construction_Male_01', 'Construction_Female_01', 'Delivery_Male_01', 'Gardener_Male_01', 'Security_Male_01',
  'Sports_Female_01', 'Sports_Male_02', 'Wood_Male_01', 'Female_Adult_02', 'Female_Adult_05', 'Female_Adult_08',
  'Female_Adult_12', 'Male_Adult_04', 'Male_Adult_07', 'Male_Adult_11', 'Male_Adult_15', 'Police_Male_03',
  'Fire_Male_04', 'Medical_Female_03',
];

export const isFemale = (look) => /Female/.test(look);

// a job from the look (the uniform says it)
const JOBS = { Police: 'police officer', Fire: 'firefighter', Medical: 'nurse', Chef: 'chef', Business: 'office worker', Construction: 'builder', Delivery: 'delivery driver', Gardener: 'gardener', Security: 'security guard', Sports: 'fitness coach', Wood: 'carpenter' };
export const jobOf = (look) => JOBS[look.split('_')[0]] || ['teacher', 'shop assistant', 'student', 'retired', 'mechanic', 'cashier', 'bus driver', 'writer'][[...look].reduce((a, c) => a + c.charCodeAt(0), 0) % 8];

const FIRST_F = ['Emma', 'Olivia', 'Sophie', 'Grace', 'Chloe', 'Mia', 'Lucy', 'Hannah', 'Ella', 'Amelia', 'Zoe', 'Ruby', 'Jess', 'Nora', 'Isla', 'Maya'];
const FIRST_M = ['Jack', 'Liam', 'Noah', 'Oliver', 'Leo', 'Ethan', 'Max', 'Sam', 'Ben', 'Lucas', 'Owen', 'Ryan', 'Tom', 'Dan', 'Adam', 'Kai'];
const LAST = ['Smith', 'Jones', 'Taylor', 'Brown', 'Wilson', 'Evans', 'Walker', 'Wright', 'Green', 'Hall', 'Wood', 'Clarke', 'Hughes', 'Turner', 'Baker', 'Cooper', 'Reed', 'Ward', 'Price', 'Bell'];
const used = new Set();
// a real name for a townsperson (no two the same)
export function nameFor(look) {
  const first = isFemale(look) ? FIRST_F : FIRST_M;
  for (let i = 0; i < 50; i++) {
    const n = `${first[(Math.random() * first.length) | 0]} ${LAST[(Math.random() * LAST.length) | 0]}`;
    if (!used.has(n)) { used.add(n); return n; }
  }
  return `${first[0]} ${LAST[used.size % LAST.length]}`;
}
