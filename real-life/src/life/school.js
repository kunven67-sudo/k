// School (master list §20). Maple Hollow Elementary is across Elm Ave. On school days you walk
// there and go in before 8:05 (late = tardy, after 9 = absent and the school calls home). The
// day plays out from how you came in: tired = you nod off in math, hungry = can't focus, smelly
// = kids notice, homework not done = the teacher notices. Grades build up into a report card.
// Classrooms you walk around in come in a later update; for now the day is summed up for you.
//
//   const school = new School(life)
//   school.homeworkLeft -> bool          school.d.grades -> { math, reading, science, art, gym }

import * as THREE from 'three';
import { bus } from '../core/events.js';
import { clock } from '../core/clock.js';
import { save } from '../core/save.js';
import { el } from '../core/util.js';
import { openPanel, row } from '../ui/panel.js';
import { me } from './me.js';
import { SCHOOL, CURB } from '../world/layout.js';

const SUBJECTS = ['math', 'reading', 'science', 'art', 'gym'];
const LETTER = (v) => (v >= 0.93 ? 'A' : v >= 0.9 ? 'A-' : v >= 0.87 ? 'B+' : v >= 0.83 ? 'B' : v >= 0.8 ? 'B-' : v >= 0.77 ? 'C+' : v >= 0.73 ? 'C' : v >= 0.7 ? 'C-' : v >= 0.65 ? 'D' : 'F');
const TOPICS = {
  math: ['fractions', 'long division', 'times tables', 'word problems', 'decimals', 'measuring angles'],
  reading: ['a chapter book', 'spelling words', 'a book report', 'vocabulary', 'reading out loud'],
  science: ['the water cycle', 'planets', 'plants + seeds', 'magnets', 'the food chain', 'volcanoes'],
  art: ['clay pots', 'self portraits', 'watercolors', 'paper mache'],
  gym: ['dodgeball', 'the mile run', 'kickball', 'climbing the rope', 'basketball drills'],
};

save.registerSlice('school', {
  create: () => ({ grades: { math: 0.82, reading: 0.82, science: 0.82, art: 0.85, gym: 0.85 }, homework: null, attended: {}, tardies: 0, absences: 0, days: 0, lastReport: null }),
});

export class School {
  constructor(life) {
    this.life = life;
    const door = new THREE.Vector3(SCHOOL.x0 + 8 - 0.3, CURB, (SCHOOL.z0 + 20 + SCHOOL.z1 - 6) / 2);
    this.door = door;
    this._it = life.world.interact.add({
      kind: 'school-door',
      box: new THREE.Box3().setFromCenterAndSize(door.clone().setY(CURB + 1.3), new THREE.Vector3(0.8, 2.6, 3.4)),
      label: () => this._label(),
      use: () => this.goIn(),
    });
    this._offs = [bus.on('clock:hour', () => this._hourly())];
  }

  get d() {
    return save.slice('school');
  }

  get homeworkLeft() {
    const hw = this.d.homework;
    return !!hw && !hw.done;
  }

  _schoolDay() {
    return clock.isSchoolDay && clock.age >= 5 && clock.age < 18 && !this._summer();
  }

  _summer() {
    return clock.season === 'summer'; // summer break
  }

  _label() {
    const h = clock.hourFloat;
    if (clock.age >= 18) return 'Maple Hollow Elementary (locked)';
    if (this._summer()) return "It's summer break! School's locked.";
    if (!clock.isSchoolDay) return "It's the weekend. The doors are locked.";
    if (this.d.attended[clock.dayIndex]) return 'School\'s out for today.';
    if (h < 7) return 'Too early, the doors are still locked.';
    if (h < 8.08) return 'Go to school';
    if (h < 15) return 'Go to school (you\'re late!)';
    return "School's over for today.";
  }

  goIn() {
    const h = clock.hourFloat;
    if (!this._schoolDay() || this.d.attended[clock.dayIndex] || h < 7 || h >= 15) {
      this.life.hud.toast(this._label());
      return;
    }
    const late = h >= 8.08;
    this.d.attended[clock.dayIndex] = { late, absent: false };
    if (late) this.d.tardies++;
    this.d.days++;
    // How you show up decides how the day goes.
    const N = me.needs;
    const tired = N.energy < 0.35;
    const hungry = N.hunger < 0.3;
    const smelly = N.hygiene < 0.25;
    const sick = (me.data.sick || 0) > 0.3;
    const hwDue = this.d.homework && this.d.homework.due <= clock.dayIndex;
    const hwDone = hwDue && this.d.homework.done;
    const focus = 1 - (tired ? 0.35 : 0) - (hungry ? 0.25 : 0) - (sick ? 0.3 : 0) - (late ? 0.1 : 0);
    const events = [];
    const day = clock.dayIndex;
    for (const sub of SUBJECTS) {
      const topic = TOPICS[sub][(day + sub.length) % TOPICS[sub].length];
      let score = 0.72 + focus * 0.22 + (hwDue && sub === this.d.homework.subject ? (hwDone ? 0.1 : -0.25) : 0);
      if (sub === 'gym') score = 0.75 + (N.energy * 0.15) - (me.data.weight > 0.7 ? 0.1 : 0) - (sick ? 0.2 : 0);
      if (sub === 'art') score = 0.8 + focus * 0.12;
      score = Math.max(0.4, Math.min(1, score));
      this.d.grades[sub] = this.d.grades[sub] * 0.85 + score * 0.15; // grades move slowly
      let note = '';
      if (sub === 'math' && tired) note = 'You nodded off. The teacher tapped your desk.';
      else if (sub === 'reading' && hungry) note = "Your stomach growled so loud the kid next to you laughed.";
      else if (hwDue && sub === this.d.homework.subject) note = hwDone ? 'You turned in your homework. Gold star!' : 'You didn\'t have your homework. The teacher wrote a note for your parents.';
      else if (sub === 'gym' && sick) note = 'You sat out, you feel awful.';
      const good = { math: ['You got every problem right on the board.', 'Quiz today. You think you aced it.'], reading: ['You read a page out loud without messing up.', 'The book is actually getting good.'], science: ['You got to do the experiment part.', 'You answered a question nobody else knew.'], art: ['Your teacher hung yours on the wall.', 'You got paint everywhere. Worth it.'], gym: ['You were the last one standing.', 'You beat your mile time.'] }[sub];
      const ok = { math: ['Kind of confusing, but you got most of it.'], reading: ['You zoned out a little.'], science: ['Lots of notes. Your hand hurts.'], art: ['Yours came out... different.'], gym: ['You got hit in the first minute.'] }[sub];
      events.push(row(`${cap(sub)}: ${topic}`, note || (score > 0.88 ? good[day % good.length] : score > 0.75 ? ok[0] : 'Rough class. You didn\'t get much of it.'), []));
    }
    // Lunch: cafeteria costs money (or free for families who can't afford it).
    const wealth = save.life.family.house.wealth;
    let lunch;
    if (wealth === 'poor') {
      lunch = 'Free school lunch: a square pizza, corn and chocolate milk.';
      me.restore('hunger', 0.45);
    } else if (me.cash >= 2.75) {
      me.spend(2.75);
      lunch = 'You bought lunch ($2.75): chicken nuggets, tater tots, an apple.';
      me.restore('hunger', 0.45);
    } else {
      lunch = "You had no lunch money. Your friend gave you half a sandwich.";
      me.restore('hunger', 0.15);
    }
    if (smelly) events.push(row('Recess', 'A kid said you smell. Everyone laughed. You should shower.', []));
    else events.push(row('Recess', ['You played tag till the bell rang.', 'Four square. You made it to king.', 'You and your friends hung out on the monkey bars.'][day % 3], []));
    // Homework for tomorrow.
    const sub = ['math', 'reading', 'science'][day % 3];
    if (hwDue) this.d.homework = null;
    this.d.homework = { subject: sub, topic: TOPICS[sub][(day + 1) % TOPICS[sub].length], due: day + (clock.weekday === 5 ? 3 : 1), done: false };
    // Time passes until 3:15 PM, the school day takes it out of you.
    const mins = 15.25 * 60 - clock.minutes;
    this.life.skip(mins, { fade: true });
    setTimeout(() => {
      me.restore('social', 0.4);
      me.restore('fun', -0.1);
      me.set('energy', Math.max(0.1, me.needs.energy - 0.1));
      me.restore('bladder', 0.6); // school bathrooms exist
      const p = openPanel({ title: late ? 'School day (late!)' : 'School day', sub: `${clock.weekdayName} · Maple Hollow Elementary`, wide: false });
      p.setBody([
        el('div', { class: 'rl-list' }, events),
        el('p', { class: 'rl-note' }, [lunch]),
        el('p', { class: 'rl-note' }, [`Homework: ${this.d.homework.subject}, ${this.d.homework.topic}. Do it at your desk at home.`]),
      ]);
      p.setButtons([{ text: 'Head home', kind: 'go', onClick: () => p.close() }]);
      this.life.player.place(this.door.clone().add(new THREE.Vector3(-2.2, 0, 0)), Math.PI / 2);
      if (hwDue && !hwDone) bus.emit('school:note', { why: 'homework' });
    }, 900);
  }

  doHomework() {
    const hw = this.d.homework;
    if (!hw || hw.done) return false;
    hw.done = true;
    const mins = clock.age < 10 ? 30 : 50;
    this.life.skip(mins, { fade: true });
    me.restore('fun', -0.12);
    this.life.hud.toast(`You finish your ${hw.subject} homework (${hw.topic}).`);
    bus.emit('chore:done', { chore: 'homework' });
    return true;
  }

  _hourly() {
    // 9 AM on a school day and you never showed up: the office calls your parents.
    if (clock.hour === 9 && this._schoolDay() && !this.d.attended[clock.dayIndex]) {
      this.d.attended[clock.dayIndex] = { absent: true };
      this.d.absences++;
      const sick = (me.data.sick || 0) > 0.35;
      if (sick) {
        this.life.hud.toast('You stayed home sick today.');
        return;
      }
      this.life.hud.toast('The school just called your parents: you weren\'t in class today.', 5000);
      bus.emit('rule:broken', { rule: 'skip-school', severity: 0.9 });
    }
  }

  /** Report card (every 4 school weeks, on a Friday). */
  reportCard() {
    const g = this.d.grades;
    return SUBJECTS.map((s) => [cap(s), LETTER(g[s])]);
  }

  dispose() {
    for (const off of this._offs) off();
    this.life.world.interact.remove(this._it);
  }
}

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
