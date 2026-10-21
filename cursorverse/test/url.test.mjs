import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toUrl } from '../src/shared/url.mjs';

test('web addresses', () => {
  assert.equal(toUrl('youtube.com'), 'https://youtube.com');
  assert.equal(toUrl('  www.google.com/search?q=hi '), 'https://www.google.com/search?q=hi');
  assert.equal(toUrl('http://example.com'), 'http://example.com');
  assert.equal(toUrl('https://a.b/c d'), 'https://www.google.com/search?q=https%3A%2F%2Fa.b%2Fc%20d');
  assert.equal(toUrl('localhost:3000'), 'https://localhost:3000');
  assert.equal(toUrl('google.com:8080/x'), 'https://google.com:8080/x');
  assert.equal(toUrl('192.168.1.1'), 'https://192.168.1.1');
});

test('searches', () => {
  assert.equal(toUrl('how to tame a bug'), 'https://www.google.com/search?q=how%20to%20tame%20a%20bug');
  assert.equal(toUrl('minecraft'), 'https://www.google.com/search?q=minecraft');
  assert.equal(toUrl('cats', 'duckduckgo'), 'https://duckduckgo.com/?q=cats');
  assert.equal(toUrl('cats', 'nope'), 'https://www.google.com/search?q=cats');
});

test('dangerous schemes become searches', () => {
  assert.match(toUrl('javascript:alert(1)'), /^https:\/\/www\.google\.com\/search\?q=/);
  assert.match(toUrl('file:///C:/Windows'), /^https:\/\/www\.google\.com\/search\?q=/);
});

test('empty input', () => {
  assert.equal(toUrl(''), null);
  assert.equal(toUrl('   '), null);
  assert.equal(toUrl(null), null);
});
