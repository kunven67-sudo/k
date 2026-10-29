/* Holidays: free themes + music you just get, starting early like real games do
   (Halloween all October, Christmas all December...), with "ends in X days". Each one has an off switch. */
export const HOLIDAYS = [
  { id: 'mybday', name: 'Your birthday', from: [8, 30], to: [8, 30], theme: 'party', note: 'Happy birthday bro' },
  { id: 'gs3bday', name: 'Game System 3\'s birthday', from: [10, 26], to: [10, 26], theme: 'party', note: 'Game System 3 turns a year older' },
  { id: 'halloween', name: 'Halloween', from: [10, 1], to: [10, 31], theme: 'halloween', music: 'music-halloween' },
  { id: 'christmas', name: 'Christmas', from: [12, 1], to: [12, 31], theme: 'christmas' },
  { id: 'newyear', name: 'New Year', from: [1, 1], to: [1, 3], theme: 'newyear' }
];

function dayOf(now, md) { return new Date(now.getFullYear(), md[0] - 1, md[1]); }

/* the holiday going on right now (birthdays win over the rest), or null */
export function currentHoliday(now, off) {
  now = now || new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (const h of HOLIDAYS) {
    if ((off || []).indexOf(h.id) >= 0) continue;
    if (today >= dayOf(now, h.from) && today <= dayOf(now, h.to)) return h;
  }
  return null;
}

/* "ends in 3 days" / "last day" */
export function endsText(h, now) {
  now = now || new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const left = Math.round((dayOf(now, h.to) - today) / 86400000);
  if (h.note) return h.note;
  return left <= 0 ? 'last day' : 'ends in ' + left + (left === 1 ? ' day' : ' days');
}
