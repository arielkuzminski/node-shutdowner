import assert from 'node:assert/strict';
import { request } from 'node:http';
import { test, type TestContext } from 'node:test';
import { startGuiServer, type GuiServerOptions, type GuiState } from '../src/gui/server.ts';
import type { ShutdownCommand } from '../src/shutdown.ts';

const command: ShutdownCommand = { file: 'shutdown.exe', args: ['/s', '/t', '0'] };

async function setup(t: TestContext, overrides: Partial<GuiServerOptions> = {}) {
  const shutdowns: ShutdownCommand[] = [];
  const server = await startGuiServer({
    port: 0,
    dryRun: false,
    command,
    runShutdown: async (cmd) => void shutdowns.push(cmd),
    dryRunResetMs: 50,
    ...overrides,
  });
  t.after(() => server.close());

  const { origin, hash } = new URL(server.url);
  const token = new URLSearchParams(hash.slice(1)).get('t')!;
  const call = (path: string, init: { method?: string; headers?: Record<string, string>; body?: unknown } = {}) =>
    fetch(`${origin}/api/${path}`, {
      method: init.method ?? 'POST',
      headers: { 'X-Token': token, 'Content-Type': 'application/json', ...init.headers },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });

  /** Collects states from the event stream; `next(pred, since)` waits for the first match at index >= since. */
  const controller = new AbortController();
  t.after(() => controller.abort());
  const res = await fetch(`${origin}/api/events?t=${token}`, { signal: controller.signal });
  const states: GuiState[] = [];
  const waiters: { pred: (s: GuiState) => boolean; resolve: (s: GuiState) => void }[] = [];
  void (async () => {
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      for await (const chunk of res.body!) {
        buffer += decoder.decode(chunk, { stream: true });
        let end;
        while ((end = buffer.indexOf('\n\n')) !== -1) {
          const state = JSON.parse(buffer.slice(0, end).replace(/^data: /, '')) as GuiState;
          buffer = buffer.slice(end + 2);
          states.push(state);
          for (const w of waiters.filter((w) => w.pred(state))) {
            waiters.splice(waiters.indexOf(w), 1);
            w.resolve(state);
          }
        }
      }
    } catch {
      // aborted at teardown
    }
  })();
  const next = (pred: (s: GuiState) => boolean, since = 0) =>
    new Promise<GuiState>((resolve) => {
      const seen = states.slice(since).find(pred);
      if (seen) resolve(seen);
      else waiters.push({ pred, resolve });
    });

  return { server, origin, token, call, states, next, shutdowns };
}

test('serves the page with security headers', async (t) => {
  const { origin } = await setup(t);
  const res = await fetch(`${origin}/`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-security-policy') ?? '', /default-src 'self'/);
  assert.match(await res.text(), /<title>Shutdowner<\/title>/);
  assert.equal((await fetch(`${origin}/app.js`)).status, 200);
  assert.equal((await fetch(`${origin}/../package.json`)).status, 404);
  assert.equal((await fetch(`${origin}/src/cli.ts`)).status, 404);
});

test('rejects requests without the right token, host or origin', async (t) => {
  const { origin, call } = await setup(t);
  assert.equal((await call('cancel', { headers: { 'X-Token': 'nope' } })).status, 403);
  assert.equal((await fetch(`${origin}/api/info`)).status, 403);
  assert.equal((await fetch(`${origin}/api/events?t=nope`)).status, 403);
  assert.equal((await call('cancel', { headers: { Origin: 'https://evil.example' } })).status, 403);

  // fetch() won't let us override Host, so use a raw request (DNS rebinding scenario).
  const status = await new Promise<number>((resolve, reject) => {
    const req = request(`${origin}/`, { headers: { Host: 'evil.example' } }, (res) => {
      res.resume();
      resolve(res.statusCode ?? 0);
    });
    req.on('error', reject).end();
  });
  assert.equal(status, 403);
});

test('validates the start request', async (t) => {
  const { call } = await setup(t);
  for (const seconds of [0, -5, 1.5, '10', null]) {
    assert.equal((await call('start', { body: { seconds } })).status, 400, `seconds=${seconds}`);
  }
  const noJson = await call('start', { headers: { 'Content-Type': 'text/plain' }, body: { seconds: 5 } });
  assert.equal(noJson.status, 415);
});

test('runs a countdown with pause and resume, then shuts down exactly once', async (t) => {
  const { call, next, shutdowns, states } = await setup(t);
  assert.deepEqual((await (await call('info', { method: 'GET' })).json()) as unknown, {
    dryRun: false,
    command: 'shutdown.exe /s /t 0',
  });

  assert.equal((await call('start', { body: { seconds: 2 } })).status, 204);
  const running = await next((s) => s.status === 'running');
  assert.equal(running.clock, '0:02');

  await call('pause');
  const paused = await next((s) => s.status === 'paused');
  assert.match(paused.caption, /^Wstrzymano — zostało 0 minut, 2 sekundy$/);
  await call('resume');

  await next((s) => s.status === 'done');
  await new Promise((r) => setTimeout(r, 100));
  assert.deepEqual(shutdowns, [{ file: 'shutdown.exe', args: ['/s', '/t', '0'] }]);
  assert.equal(states.filter((s) => s.status === 'done').length, 1);
});

test('cancel stops the countdown', async (t) => {
  const { call, next, shutdowns, states } = await setup(t);
  await call('start', { body: { seconds: 1 } });
  await next((s) => s.status === 'running');
  const since = states.length;
  await call('cancel');
  await next((s) => s.status === 'idle', since);
  await new Promise((r) => setTimeout(r, 1200));
  assert.equal(shutdowns.length, 0);
});

test('dry run never shuts down and returns to idle', async (t) => {
  const { call, next, shutdowns, states } = await setup(t, { dryRun: true });
  await call('start', { body: { seconds: 1 } });
  const done = await next((s) => s.status === 'done');
  assert.equal(done.caption, 'Tryb próbny — wykonałbym: shutdown.exe /s /t 0');
  await next((s) => s.status === 'idle', states.indexOf(done));
  assert.equal(shutdowns.length, 0);
});

test('a failed shutdown is reported and the timer returns to idle', async (t) => {
  const { call, next } = await setup(t, {
    runShutdown: async () => {
      throw new Error('access denied');
    },
  });
  await call('start', { body: { seconds: 1 } });
  const failed = await next((s) => s.status === 'idle' && s.error !== null);
  assert.match(failed.error ?? '', /access denied/);
});
