// Random people: names, looks, personality traits and real-life jobs.
import { rand } from '../core/util.js';
import { HAIR_STYLES } from './parts.js';

export const SKIN = [0xffe0c7, 0xf6d0b1, 0xe8b893, 0xd9a07a, 0xc68863, 0xa86b45, 0x8d5534, 0x6e3f24, 0x55301c, 0xf3c7a8, 0xdcae8c];
export const HAIR_COLORS = [0x1b1410, 0x2c1d12, 0x4a2f1b, 0x6b4426, 0x8c5a2b, 0xb0793c, 0xd9b26a, 0xe8d7a5, 0x8a8a8a, 0xdcdcdc, 0x9b2d1f, 0xc2481f, 0x2b2b2b];
export const FUN_HAIR = [0x3f7cff, 0xff4f9a, 0x58e07f, 0x9b59ff];
export const CLOTH = [0x2f6db5, 0xc0392b, 0x27ae60, 0xf1c40f, 0x8e44ad, 0xe67e22, 0x1abc9c, 0x34495e, 0xecf0f1, 0x222222, 0x7f8c8d, 0xd35485, 0x5d4037, 0x3c6e47, 0xa1887f, 0x5c7cfa, 0xff8a65, 0x9ccc65];
export const PANTS = [0x2c3e50, 0x34495e, 0x1f3a5f, 0x3b3b3b, 0x5d4037, 0x6d7a6d, 0x222222, 0x7b8fa6, 0x8d6e63, 0xb3a079];
export const SHOES = [0x222222, 0xf5f5f5, 0x6d4c41, 0x8d1f1f, 0x1f4f8d, 0x444444];
export const EYES = [0x2b1d0e, 0x3d2914, 0x1d3b5c, 0x2e5a2e, 0x4a4a4a, 0x111111];

export const MALE = ['Marco', 'Dante', 'Tyrell', 'Jake', 'Luis', 'Omar', 'Kevin', 'Derek', 'Andre', 'Hector', 'Ray', 'Mike', 'Tommy', 'Jamal', 'Ethan', 'Ivan', 'Raj', 'Chen', 'Darnell', 'Cody', 'Victor', 'Sam', 'Nate', 'Felix', 'Gus', 'Hank', 'Leo', 'Malik', 'Pedro', 'Sergio', 'Brandon', 'Kyle', 'Troy', 'Wes', 'Dmitri', 'Kenji', 'Abdul', 'Rico', 'Earl', 'Bobby', 'Curtis', 'Dwayne', 'Mateo', 'Owen', 'Zeke'];
export const FEMALE = ['Dana', 'Lisa', 'Keisha', 'Maria', 'Tasha', 'Priya', 'Emma', 'Rosa', 'Jade', 'Brenda', 'Nina', 'Sofia', 'Amber', 'Tiffany', 'Mei', 'Olga', 'Fatima', 'Grace', 'Becky', 'Carmen', 'Destiny', 'Hannah', 'Iris', 'Jasmine', 'Kim', 'Lola', 'Monique', 'Nora', 'Paula', 'Quinn', 'Rita', 'Sandra', 'Tamara', 'Uma', 'Vera', 'Wendy', 'Yvette', 'Zoe', 'Aisha', 'Bianca', 'Crystal', 'Gina', 'Leah', 'Mya'];
export const LAST = ['Johnson', 'Garcia', 'Smith', 'Nguyen', 'Brown', 'Lopez', 'Patel', 'Kim', 'Walker', 'Rivera', 'Thompson', 'Okafor', 'Kowalski', 'Ramirez', 'Davis', 'Moore', 'Jackson', 'Lee', 'Martinez', 'Reyes', 'Fischer', 'Ivanov', 'Tanaka', 'Haddad', 'Novak', 'Bailey', 'Price', 'Hughes', 'Ortiz', 'Silva'];

// trait -> short description used in the info card
export const TRAITS = {
  brave: 'Brave', coward: 'Coward', kind: 'Kind', cruel: 'Cruel', greedy: 'Greedy', generous: 'Generous',
  leader: 'Natural leader', follower: 'Follower', lazy: 'Lazy', hardworking: 'Hard worker', funny: 'Funny', grumpy: 'Grumpy',
  romantic: 'Romantic', loner: 'Loner', religious: 'Religious', rebel: 'Rebel', obedient: 'Obedient', smart: 'Smart',
  dumb: 'Not smart', liar: 'Liar', honest: 'Honest', crazy: 'Unhinged', calm: 'Calm', hothead: 'Hothead', clean: 'Clean', messy: 'Messy',
  flirty: 'Flirty', loyal: 'Loyal', jealous: 'Jealous', strong: 'Strong', weak: 'Weak', cusser: 'Cusses a lot', polite: 'Never cusses',
};
const OPPOSITE = { brave: 'coward', kind: 'cruel', greedy: 'generous', leader: 'follower', lazy: 'hardworking', funny: 'grumpy', rebel: 'obedient', smart: 'dumb', liar: 'honest', crazy: 'calm', clean: 'messy', strong: 'weak', cusser: 'polite', loner: 'flirty', loyal: 'liar', hothead: 'calm' };

// job -> skills (0..2) and clothes
export const JOBS = {
  mechanic: { label: 'Mechanic', build: 1.5, craft: 2, tech: 1.5, fight: 1, shirt: 0x3f5f7f, top: 'long', pants: 0x2c3e50, hat: 'cap' },
  nurse: { label: 'Nurse', heal: 2, cook: 0.5, shirt: 0x6fc7c0, top: 'tee', pants: 0x6fc7c0 },
  doctor: { label: 'Doctor', heal: 2.5, tech: 1, shirt: 0xf2f2f2, top: 'long', pants: 0x37474f },
  cop: { label: 'Police officer', fight: 2, lead: 1.5, shirt: 0x1d2f55, top: 'uniform', pants: 0x1d2f55, hat: 'cop' },
  chef: { label: 'Chef', cook: 2.5, shirt: 0xf5f5f5, top: 'long', pants: 0x333333, hat: 'chef' },
  farmer: { label: 'Farmer', gather: 2, farm: 2.5, build: 1, shirt: 0xa83a32, top: 'long', pants: 0x2f4f7f, hat: 'cap' },
  builder: { label: 'Construction worker', build: 2.5, gather: 1.5, fight: 1, shirt: 0xff9800, top: 'tee', pants: 0x5d6d7e, hat: 'hard' },
  teacher: { label: 'Teacher', lead: 1.2, tech: 1, shirt: 0x8d6e63, top: 'long', pants: 0x4e4e4e },
  office: { label: 'Office worker', tech: 0.8, shirt: 0xdfe6ee, top: 'long', pants: 0x2b2b2b },
  artist: { label: 'Artist', art: 2.5, shirt: 0x9b59b6, top: 'tee', pants: 0x2c3e50, hat: 'beanie' },
  musician: { label: 'Musician', art: 2, fun: 2, shirt: 0x222222, top: 'tee', pants: 0x1a1a1a },
  programmer: { label: 'Programmer', tech: 2.5, shirt: 0x3a3a3a, top: 'hoodie', pants: 0x2c3e50 },
  soldier: { label: 'Army vet', fight: 2.5, build: 1, lead: 1, shirt: 0x556b2f, top: 'tee', pants: 0x556b2f },
  firefighter: { label: 'Firefighter', fight: 1.5, heal: 1, build: 1, shirt: 0x8b1a1a, top: 'tee', pants: 0x3e2723 },
  mailman: { label: 'Mail carrier', gather: 1.2, shirt: 0x8fa9c9, top: 'tee', pants: 0x2f3e5c, hat: 'cap' },
  delivery: { label: 'Delivery driver', gather: 1.3, shirt: 0x6b4226, top: 'tee', pants: 0x4b3621, hat: 'cap' },
  coach: { label: 'Gym coach', fight: 1.8, lead: 1.2, shirt: 0xc62828, top: 'tank', pants: 0x212121, bottom: 'shorts' },
  electrician: { label: 'Electrician', tech: 2, build: 1.5, shirt: 0x37474f, top: 'long', pants: 0x263238, hat: 'hard' },
  scientist: { label: 'Scientist', tech: 2.8, heal: 1, shirt: 0xeeeeee, top: 'long', pants: 0x37474f, glasses: true },
  lawyer: { label: 'Lawyer', lead: 1.5, shirt: 0x263238, top: 'suit', pants: 0x263238 },
  priest: { label: 'Pastor', lead: 1, heal: 0.5, shirt: 0x111111, top: 'long', pants: 0x111111 },
  barber: { label: 'Barber', art: 1, shirt: 0x5b6d7a, top: 'tee', pants: 0x333333 },
  cashier: { label: 'Cashier', shirt: 0xd32f2f, top: 'tee', pants: 0x333333 },
  homeless: { label: 'No job', gather: 1.5, shirt: 0x6d6552, top: 'hoodie', pants: 0x4a4436, beanie: true },
  hunter: { label: 'Hunter', fight: 2, gather: 2, shirt: 0x4b5320, top: 'long', pants: 0x4b3621, hat: 'cap' },
  student: { label: 'College student', tech: 1, fun: 1.5, shirt: 0x7e57c2, top: 'hoodie', pants: 0x37474f },
};
export const JOB_KEYS = Object.keys(JOBS);
export const STREET_JOBS = ['office', 'cashier', 'mailman', 'delivery', 'student', 'teacher', 'nurse', 'programmer', 'lawyer', 'coach', 'barber', 'artist', 'musician', 'homeless', 'chef', 'builder', 'mechanic', 'electrician'];

export function randomTraits(r = rand, n = 4) {
  const keys = Object.keys(TRAITS);
  const out = [];
  let guard = 0;
  while (out.length < n && guard++ < 100) {
    const t = r.pick(keys);
    if (out.includes(t)) continue;
    if (out.some((o) => OPPOSITE[o] === t || OPPOSITE[t] === o)) continue;
    out.push(t);
  }
  return out;
}

export function randomName(sex, r = rand) {
  return (sex === 'm' ? r.pick(MALE) : r.pick(FEMALE));
}

export function makeLook(opts = {}, r = rand) {
  const sex = opts.sex || (r() < 0.5 ? 'm' : 'f');
  const job = JOBS[opts.job] || {};
  const kid = opts.age === 'kid', baby = opts.age === 'baby';
  let hair = opts.hair || (sex === 'm' ? r.pick(['short', 'short', 'buzz', 'spiky', 'curly', 'afro', 'mohawk', 'bald', 'short', 'pony']) : r.pick(['long', 'long', 'bun', 'pony', 'curly', 'afro', 'short', 'long']));
  if (!HAIR_STYLES.includes(hair)) hair = 'short';
  const old = opts.age === 'old';
  const look = {
    sex,
    skin: opts.skin ?? r.pick(SKIN),
    hair,
    hairColor: opts.hairColor ?? (old ? r.pick([0x8a8a8a, 0xdcdcdc, 0xbcbcbc]) : r() < 0.06 ? r.pick(FUN_HAIR) : r.pick(HAIR_COLORS)),
    eyes: r.pick(EYES),
    shirt: opts.shirt ?? job.shirt ?? r.pick(CLOTH),
    pants: opts.pants ?? job.pants ?? r.pick(PANTS),
    shoes: r.pick(SHOES),
    top: opts.top ?? job.top ?? r.pick(['tee', 'tee', 'long', 'hoodie', 'tank']),
    bottom: opts.bottom ?? job.bottom ?? (sex === 'f' && r() < 0.25 ? 'skirt' : r() < 0.2 ? 'shorts' : 'long'),
    fat: opts.fat ?? Math.max(0, Math.min(1, r() * r() * 1.3)),
    muscle: opts.muscle ?? (r() < 0.2),
    height: opts.height ?? (baby ? 0.32 : kid ? 0.62 : (sex === 'm' ? 1.0 : 0.94) * (0.92 + r() * 0.16)),
    headScale: baby ? 1.7 : kid ? 1.32 : 1 + (r() - 0.5) * 0.08,
    eyeSize: baby ? 1.3 : kid ? 1.15 : 0.92 + r() * 0.16,
    beard: sex === 'm' && !kid && !baby && r() < 0.28,
    mustache: sex === 'm' && !kid && !baby && r() < 0.12,
    glasses: job.glasses || (!baby && r() < 0.14),
    thickBrows: r() < 0.3,
    hat: opts.hat !== undefined ? opts.hat : job.hat && r() < 0.8 ? job.hat : job.beanie ? 'beanie' : null,
    hatColor: job.hat === 'hard' ? 0xf4c20d : job.hat === 'chef' ? 0xffffff : job.hat === 'cop' ? 0x1d2f55 : r.pick(CLOTH),
    gloves: null, coat: null, goggles: false, pack: null,
    legLen: 1,
  };
  if (baby) { look.top = 'tee'; look.bottom = 'long'; look.hair = r() < 0.5 ? 'bald' : 'buzz'; look.beard = look.mustache = look.glasses = false; look.hat = null; look.fat = 0.6; }
  if (kid) { look.beard = look.mustache = false; if (look.hat === 'cop' || look.hat === 'hard' || look.hat === 'chef') look.hat = null; }
  return look;
}

// the player: mad scientist (long stained lab coat, round goggles, rubber gloves, wild hair, tool belt)
export function scientistLook(custom = {}) {
  return {
    sex: custom.sex || 'm', skin: custom.skin ?? 0xe8b893, hair: custom.hair || 'spiky', hairColor: custom.hairColor ?? 0xdcdcdc,
    eyes: 0x1d3b5c, shirt: custom.shirt ?? 0x3d4d55, pants: custom.pants ?? 0x2b2f33, shoes: 0x1a1a1a, top: 'long', bottom: 'long',
    fat: custom.fat ?? 0.15, muscle: false, height: custom.height ?? 1.02, headScale: 1.04, eyeSize: 1, beard: custom.beard ?? false, mustache: false,
    glasses: false, thickBrows: true, hat: null, hatColor: 0, gloves: custom.gloves ?? 0x2fa38a, coat: custom.coat ?? 0xe9ecdf, goggles: custom.goggles !== false, pack: 0x6d4c41, legLen: 1,
  };
}

export function voiceFor(look, r = rand) {
  const kid = look.height < 0.7;
  return {
    pitch: (look.sex === 'm' ? 120 + r() * 50 : 200 + r() * 70) * (kid ? 1.5 : 1),
    rate: 0.85 + r() * 0.35,
    formant: (look.sex === 'm' ? 0.95 : 1.12) * (0.95 + r() * 0.1),
    seed: (r() * 1000) | 0,
  };
}
