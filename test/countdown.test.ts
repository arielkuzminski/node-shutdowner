import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatRemaining, startCountdown } from '../src/countdown.ts';

test('uses Polish plural forms', () => {
  assert.equal(formatRemaining(61), 'Komputer wyłączy się za: 1 minuta, 1 sekunda');
  assert.equal(formatRemaining(2 * 60 + 22), 'Komputer wyłączy się za: 2 minuty, 22 sekundy');
  assert.equal(formatRemaining(5 * 60 + 12), 'Komputer wyłączy się za: 5 minut, 12 sekund');
  assert.equal(formatRemaining(0), 'Komputer wyłączy się za: 0 minut, 0 sekund');
});

test('counts down to zero and finishes exactly once, on time', (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'Date'] });
  const ticks: number[] = [];
  let done = 0;

  startCountdown({ totalSeconds: 3, onTick: (s) => ticks.push(s), onDone: () => done++ });
  assert.deepEqual(ticks, [3]);

  // Advance one second at a time: a single multi-second tick moves the mocked Date to the end before callbacks run.
  t.mock.timers.tick(1000);
  t.mock.timers.tick(1000);
  assert.equal(done, 0);
  t.mock.timers.tick(1000);
  assert.equal(done, 1);

  t.mock.timers.tick(1000);
  t.mock.timers.tick(1000);
  assert.deepEqual(ticks, [3, 2, 1, 0]);
  assert.equal(done, 1);
});

test('can be cancelled', (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'Date'] });
  let done = 0;
  const cancel = startCountdown({ totalSeconds: 2, onTick: () => {}, onDone: () => done++ });
  cancel();
  t.mock.timers.tick(5000);
  assert.equal(done, 0);
});
