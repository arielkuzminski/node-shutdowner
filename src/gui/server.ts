import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { formatClock, formatRemaining } from '../format.ts';
import { formatCommand, type ShutdownCommand } from '../shutdown.ts';
import { createTimer, type TimerState } from '../timer.ts';

/** What the page receives on every change: timer state plus ready-to-show texts. */
export type GuiState = TimerState & { clock: string; caption: string; error: string | null };

export interface GuiServerOptions {
  port: number;
  dryRun: boolean;
  command: ShutdownCommand | null;
  runShutdown: (command: ShutdownCommand) => Promise<void>;
  /** Called with a human-readable line for the terminal. */
  log?: (line: string) => void;
  /** How long the dry-run "done" screen stays before returning to idle. */
  dryRunResetMs?: number;
}

export interface GuiServer {
  /** Link to open; the token travels in the fragment, so it never reaches the server logs or Referer. */
  url: string;
  close: () => Promise<void>;
}

const PUBLIC_DIR = path.join(import.meta.dirname, '..', '..', 'public');
const STATIC_FILES: Record<string, { file: string; type: string }> = {
  '/': { file: 'index.html', type: 'text/html; charset=utf-8' },
  '/style.css': { file: 'style.css', type: 'text/css; charset=utf-8' },
  '/app.js': { file: 'app.js', type: 'text/javascript; charset=utf-8' },
  '/favicon.svg': { file: 'favicon.svg', type: 'image/svg+xml' },
};
const MAX_BODY_BYTES = 1024;

const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
};

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function startGuiServer(options: GuiServerOptions): Promise<GuiServer> {
  const { dryRun, command, log = () => {}, dryRunResetMs = 5000 } = options;
  const token = randomBytes(24).toString('base64url');
  const files = Object.fromEntries(
    Object.entries(STATIC_FILES).map(([route, { file, type }]) => [
      route,
      { body: readFileSync(path.join(PUBLIC_DIR, file)), type },
    ]),
  );

  const clients = new Set<ServerResponse>();
  let error: string | null = null;
  let resetTimeout: ReturnType<typeof setTimeout> | undefined;

  const view = (): GuiState => {
    const state = timer.getState();
    switch (state.status) {
      case 'idle':
        return { ...state, clock: '', caption: '', error };
      case 'running':
        return { ...state, clock: formatClock(state.remaining), caption: 'do wyłączenia', error };
      case 'paused':
        return {
          ...state,
          clock: formatClock(state.remaining),
          caption: `Wstrzymano — zostało ${formatRemaining(state.remaining)}`,
          error,
        };
      case 'done':
        return {
          ...state,
          clock: formatClock(0),
          caption: dryRun && command ? `Tryb próbny — wykonałbym: ${formatCommand(command)}` : 'Wyłączanie…',
          error,
        };
    }
  };

  const broadcast = () => {
    const data = `data: ${JSON.stringify(view())}\n\n`;
    for (const client of clients) client.write(data);
  };

  const timer = createTimer({
    onChange: broadcast,
    onDone: () => {
      if (!command) return;
      if (dryRun) {
        log(`Koniec odliczania. Tryb próbny — wykonałbym: ${formatCommand(command)}`);
        resetTimeout = setTimeout(() => {
          if (timer.getState().status === 'done') timer.cancel();
        }, dryRunResetMs);
        return;
      }
      log(`Koniec odliczania. Wyłączam: ${formatCommand(command)}`);
      options.runShutdown(command).catch((err: Error) => {
        error = `Nie udało się wyłączyć komputera (${formatCommand(command)}): ${err.message}`;
        log(error);
        timer.cancel();
      });
    },
  });

  const server = createServer((req, res) => {
    handle(req, res).catch((err: unknown) => {
      const status = err instanceof HttpError ? err.status : 500;
      if (!res.headersSent) sendJson(res, status, { error: (err as Error).message });
      else res.end();
    });
  });

  let origin = '';
  const allowedHosts = new Set<string>();

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // Only accept requests addressed to our own loopback origin (blocks DNS rebinding).
    if (!allowedHosts.has(req.headers.host ?? '')) throw new HttpError(403, 'Niedozwolony host.');

    const url = new URL(req.url ?? '/', origin);

    if (req.method === 'GET' && url.pathname in files) {
      const { body, type } = files[url.pathname]!;
      res.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': type });
      res.end(body);
      return;
    }

    if (!url.pathname.startsWith('/api/')) throw new HttpError(404, 'Nie ma takiej strony.');

    // EventSource can't send headers, so the event stream takes the token as a query parameter.
    const sentToken = url.pathname === '/api/events' ? url.searchParams.get('t') : req.headers['x-token'];
    if (typeof sentToken !== 'string' || !tokenMatches(sentToken)) throw new HttpError(403, 'Brak lub zły token.');

    if (req.method === 'GET') {
      if (url.pathname === '/api/info') {
        sendJson(res, 200, { dryRun, command: command && formatCommand(command) });
        return;
      }
      if (url.pathname === '/api/events') {
        res.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': 'text/event-stream' });
        res.write(`data: ${JSON.stringify(view())}\n\n`);
        clients.add(res);
        req.on('close', () => clients.delete(res));
        return;
      }
    }

    if (req.method !== 'POST') throw new HttpError(404, 'Nie ma takiego zasobu.');
    if (req.headers.origin !== undefined && req.headers.origin !== origin) {
      throw new HttpError(403, 'Niedozwolone źródło żądania.');
    }

    switch (url.pathname) {
      case '/api/start': {
        const body = await readJson(req);
        const seconds = (body as { seconds?: unknown } | null)?.seconds;
        if (!command) throw new HttpError(400, `Nieobsługiwany system: ${process.platform}.`);
        if (typeof seconds !== 'number' || !Number.isInteger(seconds) || seconds <= 0) {
          throw new HttpError(400, 'Podaj czas większy od zera.');
        }
        clearTimeout(resetTimeout);
        error = null;
        timer.start(seconds);
        log(`Start: ${formatRemaining(seconds)} do wyłączenia.`);
        break;
      }
      case '/api/pause':
        if (timer.getState().status === 'running') log('Pauza.');
        timer.pause();
        break;
      case '/api/resume':
        if (timer.getState().status === 'paused') log('Wznowiono.');
        timer.resume();
        break;
      case '/api/cancel':
        if (timer.getState().status !== 'idle') log('Anulowano odliczanie.');
        clearTimeout(resetTimeout);
        timer.cancel();
        break;
      default:
        throw new HttpError(404, 'Nie ma takiego zasobu.');
    }
    res.writeHead(204, SECURITY_HEADERS).end();
  }

  const tokenBuffer = Buffer.from(token);
  function tokenMatches(sent: string): boolean {
    const sentBuffer = Buffer.from(sent);
    return sentBuffer.length === tokenBuffer.length && timingSafeEqual(sentBuffer, tokenBuffer);
  }

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port, '127.0.0.1', resolve);
  });
  const { port } = server.address() as AddressInfo;
  origin = `http://127.0.0.1:${port}`;
  allowedHosts.add(`127.0.0.1:${port}`).add(`localhost:${port}`);

  return {
    url: `${origin}/#t=${token}`,
    close: async () => {
      clearTimeout(resetTimeout);
      timer.cancel();
      for (const client of clients) client.end();
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { ...SECURITY_HEADERS, 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  // Requiring JSON also forces a CORS preflight for any cross-site request, which we never approve.
  if (!req.headers['content-type']?.startsWith('application/json')) {
    throw new HttpError(415, 'Oczekiwano application/json.');
  }
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'Za duże żądanie.');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'Nieprawidłowy JSON.');
  }
}
