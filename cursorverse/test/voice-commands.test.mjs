import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCommandMap, parseUtterance, needsConfirm, delayToMs, grammarPhrases, WAKE_WORD, describeAction,
} from '../src/shared/voice-commands.mjs';

test('plain "click" is a left click', () => {
  const m = buildCommandMap();
  assert.deepEqual(parseUtterance('Click', m).action, { kind: 'mouse', op: 'click', button: 'left' });
});

test('letters work as letters and pilot words in "both" mode', () => {
  const m = buildCommandMap({ letters: 'both' });
  assert.equal(parseUtterance('click p', m).action.label, 'P');
  assert.equal(parseUtterance('click papa', m).action.label, 'P');
  assert.equal(parseUtterance('click pee', m).action.label, 'P');
  assert.equal(parseUtterance('click x-ray', m).action.label, 'X');
  assert.deepEqual(parseUtterance('click m', m).action.vks, [0x4d]);
});

test('letter style can be restricted', () => {
  const nato = buildCommandMap({ letters: 'nato' });
  assert.equal(parseUtterance('click p', nato), null);
  assert.equal(parseUtterance('click papa', nato).action.label, 'P');
  const letters = buildCommandMap({ letters: 'letters' });
  assert.equal(parseUtterance('click papa', letters), null);
  assert.equal(parseUtterance('click p', letters).action.label, 'P');
});

test('numbers, special keys and combos', () => {
  const m = buildCommandMap();
  assert.deepEqual(parseUtterance('click 7', m).action.vks, [0x37]);
  assert.deepEqual(parseUtterance('click seven', m).action.vks, [0x37]);
  assert.deepEqual(parseUtterance('click enter', m).action.vks, [0x0d]);
  assert.deepEqual(parseUtterance('click f5', m).action.vks, [0x74]);
  assert.deepEqual(parseUtterance('click f 12', m).action.vks, [0x7b]);
  assert.deepEqual(parseUtterance('click copy', m).action.vks, [0x11, 0x43]);
  assert.deepEqual(parseUtterance('click alt tab', m).action.vks, [0x12, 0x09]);
});

test('mouse phrases', () => {
  const m = buildCommandMap();
  assert.equal(parseUtterance('right click', m).action.button, 'right');
  assert.equal(parseUtterance('double click', m).action.op, 'double');
  assert.equal(parseUtterance('scroll down', m).action.notches, -3);
  assert.equal(parseUtterance('hold click', m).action.op, 'down');
  assert.equal(parseUtterance('let go', m).action.op, 'up');
});

test('custom commands override and can type text', () => {
  const m = buildCommandMap({ custom: [
    { phrase: 'gg', type: 'text', text: 'good game', enter: true },
    { phrase: 'reload', type: 'keys', vks: [0x74], label: 'F5' },
    { phrase: 'click', type: 'mouse', op: 'double' },
    { phrase: 'off one', type: 'text', text: 'x', enabled: false },
  ] });
  assert.deepEqual(parseUtterance('GG', m).action, { kind: 'text', text: 'good game', enter: true, label: 'gg', custom: true });
  assert.deepEqual(parseUtterance('reload', m).action.vks, [0x74]);
  assert.equal(parseUtterance('click', m).action.op, 'double');
  assert.equal(parseUtterance('off one', m), null);
});

test('wake word handling', () => {
  const m = buildCommandMap();
  assert.equal(parseUtterance(WAKE_WORD, m).woke, true);
  const r = parseUtterance('hey cursor click p', m);
  assert.equal(r.woke, true);
  assert.equal(r.action.label, 'P');
  const phrases = grammarPhrases(m, 'wake');
  assert.ok(phrases.includes('hey cursor click'));
  assert.ok(phrases.includes('yes'));
  assert.ok(!phrases.includes('hey cursor yes'));
});

test('unknown speech is ignored', () => {
  const m = buildCommandMap();
  assert.equal(parseUtterance('hello there', m), null);
  assert.equal(parseUtterance('', m), null);
});

test('confirm modes', () => {
  const m = buildCommandMap();
  const letter = parseUtterance('click h', m).action;
  const enter = parseUtterance('click enter', m).action;
  const click = parseUtterance('click', m).action;
  assert.equal(needsConfirm(letter, 'keys'), true);
  assert.equal(needsConfirm(enter, 'keys'), false);
  assert.equal(needsConfirm(click, 'keys'), false);
  assert.equal(needsConfirm(click, 'always'), true);
  assert.equal(needsConfirm(letter, 'never'), false);
  assert.equal(needsConfirm({ kind: 'control', op: 'yes' }, 'always'), false);
});

test('delay units', () => {
  assert.equal(delayToMs('0.1', 'ms'), 0.1);
  assert.equal(delayToMs(2, 's'), 2000);
  assert.equal(delayToMs(1, 'min'), 60000);
  assert.equal(delayToMs(-5, 's'), 0);
  assert.equal(delayToMs('abc', 's'), 0);
  assert.equal(delayToMs(999, 'min'), 3600000);
});

test('command groups can be switched off', () => {
  const m = buildCommandMap({ groups: { mouse: false, combos: false, keys: true, custom: false }, custom: [{ phrase: 'gg', type: 'text', text: 'x' }] });
  assert.equal(parseUtterance('right click', m), null);
  assert.equal(parseUtterance('click copy', m), null);
  assert.ok(parseUtterance('click enter', m));
  assert.ok(parseUtterance('click p', m));
  assert.ok(parseUtterance('yes', m));
  assert.equal(parseUtterance('gg', m), null);
});

test('describeAction', () => {
  const m = buildCommandMap();
  assert.equal(describeAction(parseUtterance('right click', m).action), 'right click');
  assert.equal(describeAction(parseUtterance('scroll up', m).action), 'scroll up');
  assert.equal(describeAction(parseUtterance('click q', m).action), 'Q');
});
