import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatClock, formatRemaining } from '../src/format.ts';

test('uses Polish plural forms', () => {
  assert.equal(formatRemaining(61), '1 minuta, 1 sekunda');
  assert.equal(formatRemaining(2 * 60 + 22), '2 minuty, 22 sekundy');
  assert.equal(formatRemaining(5 * 60 + 12), '5 minut, 12 sekund');
  assert.equal(formatRemaining(0), '0 minut, 0 sekund');
});

test('formats a clock', () => {
  assert.equal(formatClock(0), '0:00');
  assert.equal(formatClock(307), '5:07');
  assert.equal(formatClock(3723), '1:02:03');
});
