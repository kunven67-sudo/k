import { test } from 'node:test';
import assert from 'node:assert/strict';
import { askBot } from '../src/renderer/ui/help-bot.js';

const cases = [
  ['how do i make my cursor bigger', /Cursor size/],
  ['how to get my normal mouse pointer back', /normal cursor back/i],
  ['turn off typing sounds', /Sounds pill|Ctrl\+Alt\+S/],
  ['my mic doesnt hear me', /Status|microphone|Speech/i],
  ['voice keeps pressing random stuff when i talk on discord', /Stop random triggers|Hold a key/],
  ['how do i update', /Update now/],
  ['voice gets the letters wrong', /pilot words|papa/i],
  ['how do i close the app', /Quit/],
  ['add my own songs', /My music|Add songs/],
  ['what does low power mode do', /Fewer particles/],
];

for (const [q, re] of cases) {
  test(`bot: "${q}"`, () => {
    const a = askBot(q);
    assert.match(a.text, re, `answer was: ${a.text}`);
  });
}

test('bot says hi and admits when it does not know', () => {
  assert.match(askBot('yo').text, /help/i);
  const a = askBot('what is the capital of peru');
  assert.equal(a.confident, false);
});
