// REAL LIFE game clock.
//
// - 1 game day = 24 real minutes (1 real minute = 1 game hour)  ->  TIME_SCALE = 60.
// - 4 game days = 1 year of your life: each day is one season (spring, summer, fall, winter),
//   so a day stands for about 3 months. Your age comes from the day count.
// - The sky still uses the real sun and moon over Ohio: each season day is drawn on a real
//   calendar date in the middle of that season, so winter days are short and summer days long.
// - Weekdays tick one per day (school Mon-Fri, weekends free).
//
//   clock.dayIndex     whole days since the life started (day 0 = the day you were born)
//   clock.minutes      minutes since midnight (float)
//   clock.age          years (float)
//   clock.season       'spring' | 'summer' | 'fall' | 'winter'
//   clock.weekday      0 = Sunday .. 6 = Saturday
//   clock.skyUtc       UTC ms of the matching real date/time, for sun/moon math
//   events: 'clock:minute', 'clock:hour', 'clock:day', 'clock:birthday'

import { bus } from './events.js';

export const TIME_SCALE = 60;
export const DAY_MINUTES = 1440;
export const DAYS_PER_YEAR = 4;
export const SEASONS = ['spring', 'summer', 'fall', 'winter'];
// Maple Hollow, Ohio (fictional suburb just outside Columbus).
export const HOME = { name: 'Maple Hollow', lat: 40.08, lon: -82.95, tz: 'America/New_York' };
// Middle of each season on the real calendar: [month, day].
const SEASON_DATES = { spring: [4, 20], summer: [7, 18], fall: [10, 16], winter: [1, 18] };
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ---- Real sky -------------------------------------------------------------------------------

const RAD = Math.PI / 180;

function julianDay(utcMs) {
  return utcMs / 86400000 + 2440587.5;
}

// NOAA solar position. Returns { elevation, azimuth } in radians (azimuth from north, clockwise).
export function sunPosition(utcMs, lat = HOME.lat, lon = HOME.lon) {
  const jd = julianDay(utcMs);
  const T = (jd - 2451545.0) / 36525;
  const L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360;
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C =
    Math.sin(M * RAD) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
    Math.sin(2 * M * RAD) * (0.019993 - 0.000101 * T) +
    Math.sin(3 * M * RAD) * 0.000289;
  const trueLong = L0 + C;
  const omega = 125.04 - 1934.136 * T;
  const lambda = trueLong - 0.00569 - 0.00478 * Math.sin(omega * RAD);
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(omega * RAD);
  const decl = Math.asin(Math.sin(eps * RAD) * Math.sin(lambda * RAD));
  const y = Math.tan((eps / 2) * RAD) ** 2;
  const eqTime =
    4 / RAD *
    (y * Math.sin(2 * L0 * RAD) -
      2 * e * Math.sin(M * RAD) +
      4 * e * y * Math.sin(M * RAD) * Math.cos(2 * L0 * RAD) -
      0.5 * y * y * Math.sin(4 * L0 * RAD) -
      1.25 * e * e * Math.sin(2 * M * RAD));
  const d = new Date(utcMs);
  const minutes = d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60;
  let tst = (minutes + eqTime + 4 * lon) % 1440;
  if (tst < 0) tst += 1440;
  let ha = tst / 4 - 180;
  const latR = lat * RAD;
  const cosZen = Math.sin(latR) * Math.sin(decl) + Math.cos(latR) * Math.cos(decl) * Math.cos(ha * RAD);
  const zen = Math.acos(Math.min(1, Math.max(-1, cosZen)));
  const elevation = Math.PI / 2 - zen;
  let az = Math.acos(
    Math.min(1, Math.max(-1, (Math.sin(latR) * Math.cos(zen) - Math.sin(decl)) / (Math.cos(latR) * Math.sin(zen))))
  );
  az = ha > 0 ? (az + Math.PI) % (Math.PI * 2) : (3 * Math.PI - az) % (Math.PI * 2);
  return { elevation, azimuth: az };
}

// Low-precision moon position + phase (good to ~1°, plenty for a sky dome).
export function moonPosition(utcMs, lat = HOME.lat, lon = HOME.lon) {
  const d = julianDay(utcMs) - 2451545.0;
  const L = (218.316 + 13.176396 * d) * RAD;
  const M = (134.963 + 13.064993 * d) * RAD;
  const F = (93.272 + 13.22935 * d) * RAD;
  const lonEcl = L + 6.289 * RAD * Math.sin(M);
  const latEcl = 5.128 * RAD * Math.sin(F);
  const eps = 23.4397 * RAD;
  const ra = Math.atan2(Math.sin(lonEcl) * Math.cos(eps) - Math.tan(latEcl) * Math.sin(eps), Math.cos(lonEcl));
  const dec = Math.asin(Math.sin(latEcl) * Math.cos(eps) + Math.cos(latEcl) * Math.sin(eps) * Math.sin(lonEcl));
  const gmst = (280.16 + 360.9856235 * d) * RAD;
  const H = gmst + lon * RAD - ra;
  const phi = lat * RAD;
  const elevation = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  const azimuth = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)) + Math.PI;
  // Phase: 0 = new, 0.5 = full.
  const synodic = 29.530588853;
  const ref = 2451550.1; // known new moon (JD)
  let phase = ((julianDay(utcMs) - ref) / synodic) % 1;
  if (phase < 0) phase += 1;
  const illumination = (1 - Math.cos(phase * 2 * Math.PI)) / 2;
  return { elevation, azimuth, phase, illumination };
}

// ---- Time zone helpers (real DST for the sky) -------------------------------------------------

const fmtCache = new Map();
function partsFormatter(tz) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23',
    });
    fmtCache.set(tz, f);
  }
  return f;
}

function localParts(utcMs, tz) {
  const out = {};
  for (const p of partsFormatter(tz).formatToParts(new Date(utcMs))) if (p.type !== 'literal') out[p.type] = +p.value;
  return out;
}

export function zonedToUtc(year, month, day, hour = 0, minute = 0, tz = HOME.tz) {
  let guess = Date.UTC(year, month - 1, day, hour, minute);
  for (let i = 0; i < 3; i++) {
    const p = localParts(guess, tz);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute);
    guess += Date.UTC(year, month - 1, day, hour, minute) - asUtc;
  }
  return guess;
}

// ---- Clock ----------------------------------------------------------------------------------

export class GameClock {
  constructor() {
    this.speed = 1; // sleep fast-forward raises this
    this.paused = false; // menus / phone-free pauses only
    this.birthYear = new Date().getFullYear() - 8;
    this.birthSeason = 0; // index into SEASONS of the day you were born
    this.weekdayOffset = 6; // the birth day is a Saturday
    this.reset(0, 9 * 60);
  }

  /** Jump to an absolute day + minute (save load, birth, sleep). */
  reset(dayIndex, minutes) {
    this.dayIndex = Math.max(0, Math.floor(dayIndex));
    this.minutes = Math.max(0, Math.min(DAY_MINUTES - 0.001, minutes));
    this._lastMinute = Math.floor(this.minutes);
    this._lastHour = Math.floor(this.minutes / 60);
    this._skyKey = null;
  }

  /** Total game minutes since birth (monotonic). */
  get total() {
    return this.dayIndex * DAY_MINUTES + this.minutes;
  }

  set total(v) {
    this.reset(Math.floor(v / DAY_MINUTES), v - Math.floor(v / DAY_MINUTES) * DAY_MINUTES);
  }

  update(realDt) {
    if (this.paused) return;
    this.advance((realDt * TIME_SCALE * this.speed) / 60);
  }

  /** Move time forward by `mins` game minutes, firing every boundary event on the way. */
  advance(mins) {
    if (!(mins > 0)) return;
    let left = mins;
    while (left > 0) {
      const step = Math.min(left, 1);
      left -= step;
      this.minutes += step;
      if (this.minutes >= DAY_MINUTES) {
        this.minutes -= DAY_MINUTES;
        const before = this.ageYears;
        this.dayIndex++;
        bus.emit('clock:day', this.snapshot());
        if (this.ageYears !== before) bus.emit('clock:birthday', { age: this.ageYears });
      }
      const m = Math.floor(this.minutes);
      if (m !== this._lastMinute) {
        this._lastMinute = m;
        bus.emit('clock:minute', this.snapshot());
        const h = Math.floor(this.minutes / 60);
        if (h !== this._lastHour) {
          this._lastHour = h;
          bus.emit('clock:hour', this.snapshot());
        }
      }
    }
  }

  get hour() {
    return Math.floor(this.minutes / 60);
  }

  /** Hours as a float, 13.5 = 1:30 PM. */
  get hourFloat() {
    return this.minutes / 60;
  }

  get age() {
    return this.dayIndex / DAYS_PER_YEAR + this.minutes / DAY_MINUTES / DAYS_PER_YEAR;
  }

  get ageYears() {
    return Math.floor(this.dayIndex / DAYS_PER_YEAR);
  }

  get seasonIndex() {
    return (this.birthSeason + this.dayIndex) % DAYS_PER_YEAR;
  }

  get season() {
    return SEASONS[this.seasonIndex];
  }

  get year() {
    return this.birthYear + Math.floor((this.birthSeason + this.dayIndex) / DAYS_PER_YEAR);
  }

  get weekday() {
    return (this.weekdayOffset + this.dayIndex) % 7;
  }

  get weekdayName() {
    return WEEKDAYS[this.weekday];
  }

  get isSchoolDay() {
    return this.weekday >= 1 && this.weekday <= 5 && this.season !== 'summer';
  }

  get isNight() {
    return this.hourFloat < 6.5 || this.hourFloat > 20.5;
  }

  /** Real UTC time used for the sun / moon: middle of this season, at the game's clock time. */
  get skyUtc() {
    const s = this.season;
    const [mo, d] = SEASON_DATES[s];
    const y = s === 'winter' ? this.year + 1 : this.year;
    const key = `${y}-${mo}-${d}`;
    if (this._skyKey !== key) {
      this._skyKey = key;
      this._skyMidnight = zonedToUtc(y, mo, d, 0, 0, HOME.tz);
    }
    return this._skyMidnight + this.minutes * 60000;
  }

  /** Month/day shown on the phone: walks through the season's three months during the day. */
  get calendarDate() {
    const firstMonth = { spring: 3, summer: 6, fall: 9, winter: 12 }[this.season];
    const t = this.minutes / DAY_MINUTES; // 0..1 through the 3 months
    const monthOff = Math.min(2, Math.floor(t * 3));
    let month = firstMonth + monthOff;
    if (month > 12) month -= 12;
    const day = 1 + Math.floor(((t * 3) % 1) * 28);
    return { month, day, year: this.year + (this.season === 'winter' && month < 12 ? 1 : 0) };
  }

  sun() {
    return sunPosition(this.skyUtc, HOME.lat, HOME.lon);
  }

  moon() {
    return moonPosition(this.skyUtc, HOME.lat, HOME.lon);
  }

  snapshot() {
    return {
      dayIndex: this.dayIndex, minutes: this.minutes, hour: this.hour, age: this.ageYears,
      season: this.season, weekday: this.weekday, year: this.year,
    };
  }

  /** "7:05 AM" */
  timeText() {
    const h = this.hour;
    const m = Math.floor(this.minutes % 60);
    return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  }

  dateText() {
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const c = this.calendarDate;
    return `${WEEKDAYS[this.weekday].slice(0, 3)}, ${MONTHS[c.month - 1]} ${c.day}`;
  }

  /** Compatibility with GAMBLE's sky (it reads clock.gameMs and sun()/moon()). */
  get gameMs() {
    return this.skyUtc;
  }

  format() {
    return `${this.dateText()} ${this.timeText()}`;
  }
}

export const clock = new GameClock();
