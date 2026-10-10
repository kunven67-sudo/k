// Game clock + real astronomy (sun, moon, stars) for any date.
// The world uses your PC's real date/time zone. Longitude is the middle of your
// time zone, so in-game noon is around real noon on your clock.

const DEG = Math.PI / 180;

export const DAY_LENGTHS = {
  real: 86400,     // one game day = one real day
  '2h': 7200,
  '48m': 2880,
  '24m': 1440,
};

export class GameClock {
  constructor({ startMs = Date.now(), dayLength = 'real', latitude = 37.6, tzOffsetMin = new Date().getTimezoneOffset() } = {}) {
    this.ms = startMs;               // UTC milliseconds of the game moment
    this.dayLength = dayLength;
    this.latitude = latitude;
    this.tzOffsetMin = tzOffsetMin;  // minutes, like Date.getTimezoneOffset()
    this.longitude = -tzOffsetMin / 4;
    this.fastForward = 1;
  }

  get rate() { return (86400 / DAY_LENGTHS[this.dayLength]) * this.fastForward; }

  advance(realDt) { this.ms += realDt * 1000 * this.rate; }

  // Local wall-clock pieces (in the player's time zone).
  local() {
    const d = new Date(this.ms - this.tzOffsetMin * 60000);
    return {
      year: d.getUTCFullYear(), month: d.getUTCMonth(), day: d.getUTCDate(),
      hour: d.getUTCHours(), minute: d.getUTCMinutes(), second: d.getUTCSeconds(),
      weekday: d.getUTCDay(),
      hours: d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600,
    };
  }

  dayOfYear() {
    const l = this.local();
    const start = Date.UTC(l.year, 0, 1);
    return Math.floor((Date.UTC(l.year, l.month, l.day) - start) / 86400000);
  }

  // 0 = Jan 1 .. 1 = Dec 31
  yearFraction() { return this.dayOfYear() / 365.25; }

  season() {
    const doy = this.dayOfYear();
    // Northern hemisphere, by real equinox/solstice dates (approx).
    if (doy >= 79 && doy < 172) return 'spring';
    if (doy >= 172 && doy < 265) return 'summer';
    if (doy >= 265 && doy < 355) return 'fall';
    return 'winter';
  }

  formatTime(h12 = true) {
    const l = this.local();
    const m = String(l.minute).padStart(2, '0');
    if (!h12) return `${String(l.hour).padStart(2, '0')}:${m}`;
    const h = l.hour % 12 || 12;
    return `${h}:${m} ${l.hour < 12 ? 'AM' : 'PM'}`;
  }

  formatDate() {
    const d = new Date(this.ms - this.tzOffsetMin * 60000);
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  }

  sky() { return astronomy(this.ms, this.latitude, this.longitude); }
}

// ---------- Astronomy (low precision, good to well under a degree) ----------

function norm360(a) { return ((a % 360) + 360) % 360; }

export function julianDay(ms) { return ms / 86400000 + 2440587.5; }

// Local sidereal time in degrees.
export function localSiderealDeg(ms, lonDeg) {
  const n = julianDay(ms) - 2451545.0;
  const gmst = 280.46061837 + 360.98564736629 * n;
  return norm360(gmst + lonDeg);
}

function eclipticToEquatorial(lamDeg, betaDeg, epsDeg) {
  const lam = lamDeg * DEG, beta = betaDeg * DEG, eps = epsDeg * DEG;
  const ra = Math.atan2(Math.sin(lam) * Math.cos(eps) - Math.tan(beta) * Math.sin(eps), Math.cos(lam));
  const dec = Math.asin(Math.sin(beta) * Math.cos(eps) + Math.cos(beta) * Math.sin(eps) * Math.sin(lam));
  return { ra, dec }; // radians
}

// Equatorial (ra, dec radians) -> world direction {x: east, y: up, z: south}.
export function equatorialToWorld(ra, dec, lstDeg, latDeg, out = { x: 0, y: 0, z: 0 }) {
  const H = lstDeg * DEG - ra;
  const lat = latDeg * DEG;
  const cd = Math.cos(dec), sd = Math.sin(dec);
  const up = sd * Math.sin(lat) + cd * Math.cos(lat) * Math.cos(H);
  const north = sd * Math.cos(lat) - cd * Math.sin(lat) * Math.cos(H);
  const east = -cd * Math.sin(H);
  out.x = east; out.y = up; out.z = -north;
  return out;
}

export function astronomy(ms, latDeg, lonDeg) {
  const n = julianDay(ms) - 2451545.0;
  const eps = 23.439 - 0.0000004 * n;
  const lst = localSiderealDeg(ms, lonDeg);

  // Sun
  const L = norm360(280.460 + 0.9856474 * n);
  const g = norm360(357.528 + 0.9856003 * n) * DEG;
  const sunLam = L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g);
  const sunEq = eclipticToEquatorial(sunLam, 0, eps);
  const sun = equatorialToWorld(sunEq.ra, sunEq.dec, lst, latDeg);

  // Moon (main periodic terms)
  const Lp = norm360(218.316 + 13.176396 * n);
  const Mp = norm360(134.963 + 13.064993 * n) * DEG;
  const Ms = g;
  const D = norm360(297.850 + 12.190749 * n) * DEG;
  const F = norm360(93.272 + 13.229350 * n) * DEG;
  const moonLam = Lp + 6.289 * Math.sin(Mp) + 1.274 * Math.sin(2 * D - Mp) + 0.658 * Math.sin(2 * D)
    + 0.214 * Math.sin(2 * Mp) - 0.186 * Math.sin(Ms) - 0.114 * Math.sin(2 * F);
  const moonBeta = 5.128 * Math.sin(F) + 0.281 * Math.sin(Mp + F) + 0.278 * Math.sin(Mp - F);
  const moonEq = eclipticToEquatorial(moonLam, moonBeta, eps);
  const moon = equatorialToWorld(moonEq.ra, moonEq.dec, lst, latDeg);

  // Phase: 0 = new, 0.5 = full, 1 = new again.
  const elong = norm360(moonLam - sunLam);
  const phase = elong / 360;
  const illum = (1 - Math.cos(elong * DEG)) / 2;

  return { sun, moon, phase, illum, lst, eps };
}

export function moonPhaseName(phase) {
  const names = ['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent'];
  return names[Math.round(phase * 8) % 8];
}
