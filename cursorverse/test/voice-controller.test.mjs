import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { VoiceController, formatDelay } = require('../src/main/voice.js');

function fakeHost() {
  const proc = new EventEmitter();
  proc.stdout = new PassThrough();
  proc.stderr = new PassThrough();
  proc.stdin = new PassThrough();
  proc.written = [];
  proc.stdin.on('data', (d) => proc.written.push(String(d)));
  proc.kill = () => {};
  proc.say = (text, confidence = 0.95) => proc.stdout.write(`${JSON.stringify({ type: 'result', text, confidence })}\n`);
  return proc;
}

function setup(overrides = {}, allowed = true) {
  const calls = [];
  const hud = [];
  const host = fakeHost();
  const win32 = {
    click: (b, n) => { calls.push(['click', b, n]); return true; },
    mouseButton: (b, d) => { calls.push(['button', b, d]); return true; },
    scroll: (n, h) => { calls.push(['scroll', n, h]); return true; },
    pressKeys: (vks) => { calls.push(['keys', vks]); return true; },
    typeText: (t) => { calls.push(['type', t]); return true; },
  };
  const v = new VoiceController({
    win32,
    spawnHost: () => host,
    allowedNow: () => allowed,
    hud: { show: (s) => hud.push(['show', s]), hide: () => hud.push(['hide']), flash: (s) => hud.push(['flash', s]) },
  });
  const settings = {
    enabled: true, mode: 'always', confirm: 'keys', letters: 'both', delayValue: 0, delayUnit: 'ms',
    minConfidence: 0.6, endSilenceMs: 150, confirmTimeoutSec: 8, custom: [], groups: {}, ...overrides,
  };
  return { v, host, calls, hud, settings };
}

const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));

test('host gets the phrase list and "click" clicks', async () => {
  const { v, host, calls, settings } = setup();
  await v.configure(settings);
  const first = JSON.parse(host.written[0]);
  assert.ok(first.phrases.includes('click'));
  assert.equal(first.autostart, true);
  host.say('click');
  await tick();
  assert.deepEqual(calls, [['click', 'left', 1]]);
});

test('letters ask first, "yes" presses, "no" cancels', async () => {
  const { v, host, calls, hud, settings } = setup();
  await v.configure(settings);
  host.say('click h');
  await tick();
  assert.equal(calls.length, 0);
  assert.equal(hud.at(-1)[1].text, 'Did you say H?');
  host.say('yes');
  await tick();
  assert.deepEqual(calls, [['keys', [0x48]]]);
  host.say('click papa');
  await tick();
  host.say('no');
  await tick();
  assert.equal(calls.length, 1);
});

test('confirm "never" presses straight away; "always" asks even for click', async () => {
  let s = setup({ confirm: 'never' });
  await s.v.configure(s.settings);
  s.host.say('click m');
  await tick();
  assert.deepEqual(s.calls, [['keys', [0x4d]]]);

  s = setup({ confirm: 'always' });
  await s.v.configure(s.settings);
  s.host.say('click');
  await tick();
  assert.equal(s.calls.length, 0);
  s.host.say('yeah');
  await tick();
  assert.deepEqual(s.calls, [['click', 'left', 1]]);
});

test('low confidence is ignored', async () => {
  const { v, host, calls, settings } = setup({ minConfidence: 0.8 });
  await v.configure(settings);
  host.say('click', 0.5);
  await tick();
  assert.equal(calls.length, 0);
});

test('delay waits before acting', async () => {
  const { v, host, calls, settings } = setup({ delayValue: 0.15, delayUnit: 's' });
  await v.configure(settings);
  host.say('right click');
  await tick(60);
  assert.equal(calls.length, 0);
  await tick(160);
  assert.deepEqual(calls, [['click', 'right', 1]]);
});

test('wake word mode needs "hey cursor" first', async () => {
  const { v, host, calls, settings } = setup({ mode: 'wake' });
  await v.configure(settings);
  host.say('click');
  await tick();
  assert.equal(calls.length, 0);
  host.say('hey cursor');
  await tick();
  host.say('click');
  await tick();
  assert.equal(calls.length, 1);
  host.say('hey cursor double click');
  await tick();
  assert.deepEqual(calls[1], ['click', 'left', 2]);
});

test('push-to-talk starts and stops the recognizer', async () => {
  const { v, host, settings } = setup({ mode: 'ptt' });
  await v.configure(settings);
  assert.equal(JSON.parse(host.written[0]).autostart, false);
  v.pushToTalk(true);
  v.pushToTalk(true);
  v.pushToTalk(false);
  assert.deepEqual(host.written.slice(1), ['start\n', 'stop\n']);
});

test('apps outside the target list are left alone', async () => {
  const { v, host, calls, settings } = setup({}, false);
  await v.configure(settings);
  host.say('click');
  await tick();
  assert.equal(calls.length, 0);
});

test('stop listening / start listening', async () => {
  const { v, host, calls, settings } = setup();
  await v.configure(settings);
  host.say('stop listening');
  await tick();
  host.say('click');
  await tick();
  assert.equal(calls.length, 0);
  host.say('start listening');
  await tick();
  host.say('click');
  await tick();
  assert.equal(calls.length, 1);
});

test('custom text command types and presses enter', async () => {
  const { v, host, calls, settings } = setup({ custom: [{ phrase: 'gg', type: 'text', text: 'good game', enter: true }] });
  await v.configure(settings);
  host.say('gg');
  await tick();
  assert.deepEqual(calls, [['type', 'good game'], ['keys', [0x0d]]]);
});

test('hold click then let go releases the same button', async () => {
  const { v, host, calls, settings } = setup();
  await v.configure(settings);
  host.say('hold click');
  await tick();
  host.say('let go');
  await tick();
  assert.deepEqual(calls, [['button', 'left', true], ['button', 'left', false]]);
});

test('host errors become friendly messages', async () => {
  const { v, host, settings } = setup();
  await v.configure(settings);
  host.stdout.write(`${JSON.stringify({ type: 'error', code: 'no-mic', message: 'x' })}\n`);
  await tick();
  assert.equal(v.status.state, 'error');
  assert.match(v.status.message, /microphone/);
});

test('formatDelay', () => {
  assert.equal(formatDelay(0.1), '0.1 ms');
  assert.equal(formatDelay(1500), '1.5 s');
  assert.equal(formatDelay(90000), '1.5 min');
});
