#!/usr/bin/env node
import { release } from 'node:os';
import { HELP, parseArgs } from './args.ts';
import { formatRemaining, startCountdown } from './countdown.ts';
import { formatCommand, getShutdownCommand, runShutdown } from './shutdown.ts';

const parsed = parseArgs(process.argv.slice(2));

if (parsed.kind === 'help') {
  console.log(HELP);
} else if (parsed.kind === 'error') {
  console.error(`${parsed.message}\n\n${HELP}`);
  process.exitCode = 1;
} else {
  run(parsed.options.totalSeconds, parsed.options.dryRun);
}

function run(totalSeconds: number, dryRun: boolean): void {
  const command = getShutdownCommand(process.platform, release());
  if (!command) {
    console.error(`Nieobsługiwany system: ${process.platform}.`);
    process.exitCode = 1;
    return;
  }

  const tty = process.stdout.isTTY;
  const print = (line: string) => {
    if (tty) process.stdout.write(`\r${line}\x1b[K`);
    else console.log(line);
  };

  console.log(dryRun ? 'Tryb próbny — komputer nie zostanie wyłączony.' : 'Naciśnij CTRL + C, by anulować.');

  const cancel = startCountdown({
    totalSeconds,
    onTick: (remaining) => print(formatRemaining(remaining)),
    onDone: () => {
      if (tty) process.stdout.write('\n');
      if (dryRun) {
        console.log(`Wykonałbym: ${formatCommand(command)}`);
        return;
      }
      runShutdown(command).catch((err: Error) => {
        console.error(`Nie udało się wyłączyć komputera (${formatCommand(command)}): ${err.message}`);
        process.exitCode = 1;
      });
    },
  });

  process.once('SIGINT', () => {
    cancel();
    if (tty) process.stdout.write('\n');
    console.log('Anulowano.');
    process.exit(130);
  });
}
