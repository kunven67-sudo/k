// Game clock + real calendar + real sky math.
//
// - 1 game day = 48 real minutes  →  TIME_SCALE = 30 (1 real second = 30 game seconds).
// - Time is stored as a UTC epoch (ms) and displayed in the city's real time zone, so daylight
//   saving time, real holidays and real sunrise/sunset all fall out naturally.
// - A new life starts on the real-world date the player begins, at 11:00 AM in Reno.
// - Time keeps going while the game is closed (save.js applies the catch-up on load).

import { bus } from './events.js';

export const TIME_SCALE = 30;
export const RENO = { name: 'Reno', lat: 39.5296, lon: -119.8138, tz: 'America/Los_Angeles' };

const fmtCache = new Map();
function partsFormatter(tz) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric',
      weekday: 'short', hourCycle: 'h23',
    });
    fmtCache.set(tz, f);
  }
  return f;
}

export function localParts(utcMs, tz = RENO.tz) {
  const out = {};
  for (const p of partsFormatter(tz).formatToParts(new Date(utcMs))) {
    if (p.type !== 'literal') out[p.type] = p.value;
  }
  const weekdays = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: +out.year,
    month: +out.month, // 1-12
    day: +out.day,
    hour: +out.hour % 24,
    minute: +out.minute,
    second: +out.second,
    weekday: weekdays[out.weekday],
  };
}

// Convert a wall-clock time in `tz` to a UTC epoch (handles DST by iterating on the offset).
export function zonedToUtc(year, month, day, hour = 0, minute = 0, tz = RENO.tz) {
  let guess = Date.UTC(year, month - 1, day, hour, minute);
  for (let i = 0; i < 3; i++) {
    const p = localParts(guess, tz);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    const target = Date.UTC(year, month - 1, day, hour, minute);
    guess += target - asUtc;
  }
  return guess;
}

export function newLifeStartUtc(realNowMs = Date.now()) {
  const p = localParts(realNowMs, RENO.tz);
  return zonedToUtc(p.year, p.month, p.day, 11, 0, RENO.tz);
}

// ---- Real sky -------------------------------------------------------------------------------

const RAD = Math.PI / 180;

function julianDay(utcMs) {
  return utcMs / 86400000 + 2440587.5;
}

// NOAA solar position. Returns { elevation, azimuth } in radians (azimuth from north, clockwise).
export function sunPosition(utcMs, lat = RENO.lat, lon = RENO.lon) {
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
export function moonPosition(utcMs, lat = RENO.lat, lon = RENO.lon) {
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

// ---- Clock ----------------------------------------------------------------------------------

export class GameClock {
  constructor() {
    this.gameMs = newLifeStartUtc();
    this.speed = 1; // multiplier on TIME_SCALE (sleep time-lapse raises it)
    this.paused = false; // only used by menus before a life exists — the world itself never pauses
    this.tz = RENO.tz;
    this._last = localParts(this.gameMs, this.tz);
  }

  setTime(utcMs) {
    this.gameMs = utcMs;
    this._last = localParts(this.gameMs, this.tz);
  }

  update(realDt) {
    if (this.paused) return;
    this.gameMs += realDt * 1000 * TIME_SCALE * this.speed;
    const now = localParts(this.gameMs, this.tz);
    if (now.minute !== this._last.minute) bus.emit('clock:minute', now);
    if (now.hour !== this._last.hour) bus.emit('clock:hour', now);
    if (now.day !== this._last.day) bus.emit('clock:day', now);
    this._last = now;
  }

  get local() {
    return this._last;
  }

  // Hours as a float, e.g. 13.5 = 1:30 PM local.
  get hourFloat() {
    const p = this._last;
    return p.hour + p.minute / 60 + p.second / 3600;
  }

  sun(lat, lon) {
    return sunPosition(this.gameMs, lat, lon);
  }

  moon(lat, lon) {
    return moonPosition(this.gameMs, lat, lon);
  }

  format(opts = { hour: 'numeric', minute: '2-digit' }, locale = 'en-US') {
    return new Intl.DateTimeFormat(locale, { timeZone: this.tz, ...opts }).format(new Date(this.gameMs));
  }
}

export const clock = new GameClock();
