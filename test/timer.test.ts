import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { createTimer, type TimerState } from '../src/timer.ts';

// Advance one second at a time: a single multi-second tick moves the mocked Date to the end before callbacks run.
const advance = (t: TestContext, ms: number) => {
  for (; ms >= 1000; ms -= 1000) t.mock.timers.tick(1000);
  if (ms > 0) t.mock.timers.tick(ms);
};

function setup(t: TestContext) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const states: TimerState[] = [];
  let done = 0;
  const timer = createTimer({ onChange: (s) => states.push(s), onDone: () => done++ });
  const remaining = () => states.flatMap((s) => (s.status === 'running' ? [s.remaining] : []));
  return { timer, states, remaining, done: () => done };
}

test('counts down and finishes exactly once, on time', (t) => {
  const { timer, remaining, done, states } = setup(t);
  timer.start(3);
  assert.deepEqual(remaining(), [3]);

  advance(t, 2999);
  assert.equal(done(), 0);
  advance(t, 1);
  assert.equal(done(), 1);
  assert.deepEqual(states.at(-1), { status: 'done', total: 3 });

  advance(t, 5000);
  assert.deepEqual(remaining(), [3, 2, 1]);
  assert.equal(done(), 1);
});

test('pause and resume keep the exact remaining time', (t) => {
  const { timer, done, states } = setup(t);
  timer.start(5);
  advance(t, 1500);
  timer.pause();
  assert.deepEqual(states.at(-1), { status: 'paused', remaining: 4, total: 5 });

  advance(t, 60_000);
  assert.equal(done(), 0);

  timer.resume();
  advance(t, 3499);
  assert.equal(done(), 0);
  advance(t, 1);
  assert.equal(done(), 1);
});

test('ticks land on whole seconds after resuming mid-second', (t) => {
  const { timer, remaining } = setup(t);
  timer.start(3);
  advance(t, 500);
  timer.pause();
  timer.resume();
  advance(t, 500);
  assert.deepEqual(remaining(), [3, 3, 2]);
});

test('cancel stops the countdown and a new one can start', (t) => {
  const { timer, done, states } = setup(t);
  timer.start(2);
  timer.cancel();
  assert.deepEqual(states.at(-1), { status: 'idle' });
  advance(t, 5000);
  assert.equal(done(), 0);

  timer.start(1);
  advance(t, 1000);
  assert.equal(done(), 1);
});

test('pause/resume are ignored in the wrong state', (t) => {
  const { timer, states } = setup(t);
  timer.pause();
  timer.resume();
  timer.cancel();
  assert.equal(states.length, 0);
});

test('rejects invalid lengths', (t) => {
  const { timer } = setup(t);
  for (const bad of [0, -1, 1.5, NaN]) assert.throws(() => timer.start(bad), RangeError);
});
