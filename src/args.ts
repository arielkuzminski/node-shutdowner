import { parseArgs as parseNodeArgs } from 'node:util';

export interface Options {
  totalSeconds: number;
  dryRun: boolean;
}

export type ParseResult = { kind: 'run'; options: Options } | { kind: 'help' } | { kind: 'error'; message: string };

export const HELP = `Użycie: shutdowner [--minutes N] [--seconds N] [--dry-run]

Odlicza podany czas i wyłącza komputer.

Opcje:
  -m, --minutes N   minuty (mogą być ułamkowe, np. 1.5)
  -s, --seconds N   sekundy
      --dry-run     odlicz, ale zamiast wyłączać tylko wypisz komendę
  -h, --help        pokaż tę pomoc

Łączny czas musi być większy od zera.`;

function parseDuration(raw: string | undefined, name: string): number | string {
  if (raw === undefined) return 0;
  const value = Number(raw);
  if (raw.trim() === '' || !Number.isFinite(value) || value < 0) {
    return `Nieprawidłowa wartość --${name}: "${raw}". Podaj liczbę nieujemną.`;
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

  const minutes = parseDuration(values.minutes, 'minutes');
  if (typeof minutes === 'string') return { kind: 'error', message: minutes };
  const seconds = parseDuration(values.seconds, 'seconds');
  if (typeof seconds === 'string') return { kind: 'error', message: seconds };

  const totalSeconds = Math.round(minutes * 60 + seconds);
  if (totalSeconds <= 0) {
    return { kind: 'error', message: 'Podaj czas większy od zera (--minutes i/lub --seconds).' };
  }

  return { kind: 'run', options: { totalSeconds, dryRun: values['dry-run'] } };
}
