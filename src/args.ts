import { parseArgs as parseNodeArgs } from 'node:util';

export type Options =
  { mode: 'terminal'; totalSeconds: number; dryRun: boolean } | { mode: 'gui'; port: number; dryRun: boolean };

export type ParseResult = { kind: 'run'; options: Options } | { kind: 'help' } | { kind: 'error'; message: string };

export const HELP = `Użycie: shutdowner [--minutes N] [--seconds N] [--dry-run]
       shutdowner --gui [--port N] [--dry-run]

Odlicza podany czas i wyłącza komputer.

Opcje:
  -m, --minutes N   minuty (mogą być ułamkowe, np. 1.5)
  -s, --seconds N   sekundy
      --gui         zamiast terminala otwórz okno w przeglądarce
      --port N      port serwera dla --gui (domyślnie losowy)
      --dry-run     odlicz, ale zamiast wyłączać tylko wypisz komendę
  -h, --help        pokaż tę pomoc

Bez --gui łączny czas musi być większy od zera.`;

function parseDuration(raw: string | undefined, name: string): number | string {
  if (raw === undefined) return 0;
  const value = Number(raw);
  if (raw.trim() === '' || !Number.isFinite(value) || value < 0) {
    return `Nieprawidłowa wartość --${name}: "${raw}". Podaj liczbę nieujemną.`;
  }
  return value;
}

function parsePort(raw: string | undefined): number | string {
  if (raw === undefined) return 0;
  const value = Number(raw);
  if (raw.trim() === '' || !Number.isInteger(value) || value < 0 || value > 65535) {
    return `Nieprawidłowa wartość --port: "${raw}". Podaj liczbę od 0 do 65535.`;
  }
  return value;
}

export function parseArgs(argv: string[]): ParseResult {
  let values;
  try {
    ({ values } = parseNodeArgs({
      args: argv,
      options: {
        minutes: { type: 'string', short: 'm' },
        seconds: { type: 'string', short: 's' },
        gui: { type: 'boolean', default: false },
        port: { type: 'string' },
        'dry-run': { type: 'boolean', default: false },
        help: { type: 'boolean', short: 'h', default: false },
      },
      strict: true,
      allowPositionals: false,
    }));
  } catch (err) {
    return { kind: 'error', message: (err as Error).message };
  }

  if (values.help) return { kind: 'help' };
  const dryRun = values['dry-run'];

  if (values.gui) {
    if (values.minutes !== undefined || values.seconds !== undefined) {
      return { kind: 'error', message: 'Przy --gui czas ustawiasz w przeglądarce — pomiń --minutes i --seconds.' };
    }
    const port = parsePort(values.port);
    if (typeof port === 'string') return { kind: 'error', message: port };
    return { kind: 'run', options: { mode: 'gui', port, dryRun } };
  }
  if (values.port !== undefined) return { kind: 'error', message: '--port działa tylko razem z --gui.' };

  const minutes = parseDuration(values.minutes, 'minutes');
  if (typeof minutes === 'string') return { kind: 'error', message: minutes };
  const seconds = parseDuration(values.seconds, 'seconds');
  if (typeof seconds === 'string') return { kind: 'error', message: seconds };

  const totalSeconds = Math.round(minutes * 60 + seconds);
  if (totalSeconds <= 0) {
    return { kind: 'error', message: 'Podaj czas większy od zera (--minutes i/lub --seconds).' };
  }

  return { kind: 'run', options: { mode: 'terminal', totalSeconds, dryRun } };
}
