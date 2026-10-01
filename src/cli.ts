#!/usr/bin/env node
import { release } from 'node:os';
import { HELP, parseArgs } from './args.ts';
import { formatRemaining } from './format.ts';
import { openBrowser } from './gui/open-browser.ts';
import { startGuiServer } from './gui/server.ts';
import { formatCommand, getShutdownCommand, runShutdown } from './shutdown.ts';
import { createTimer } from './timer.ts';

const parsed = parseArgs(process.argv.slice(2));

if (parsed.kind === 'help') {
  console.log(HELP);
} else if (parsed.kind === 'error') {
  console.error(`${parsed.message}\n\n${HELP}`);
  process.exitCode = 1;
} else if (parsed.options.mode === 'gui') {
  await runGui(parsed.options.port, parsed.options.dryRun);
} else {
  runTerminal(parsed.options.totalSeconds, parsed.options.dryRun);
}

function runTerminal(totalSeconds: number, dryRun: boolean): void {
  const command = getShutdownCommand(process.platform, release());
  if (!command) {
    console.error(`Nieobsługiwany system: ${process.platform}.`);
    process.exitCode = 1;
    return;
  }

  const tty = process.stdout.isTTY;
  const print = (remaining: number) => {
    const line = `Komputer wyłączy się za: ${formatRemaining(remaining)}`;
    if (tty) process.stdout.write(`\r${line}\x1b[K`);
    else console.log(line);
  };

  console.log(dryRun ? 'Tryb próbny — komputer nie zostanie wyłączony.' : 'Naciśnij CTRL + C, by anulować.');

  const timer = createTimer({
    onChange: (state) => {
      if (state.status === 'running') print(state.remaining);
      else if (state.status === 'done') print(0);
    },
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
  timer.start(totalSeconds);

  process.once('SIGINT', () => {
    timer.cancel();
    if (tty) process.stdout.write('\n');
    console.log('Anulowano.');
    process.exit(130);
  });
}

async function runGui(port: number, dryRun: boolean): Promise<void> {
  const command = getShutdownCommand(process.platform, release());
  let server;
  try {
    server = await startGuiServer({
      port,
      dryRun,
      command,
      runShutdown,
      log: (line) => console.log(`[${new Date().toLocaleTimeString('pl-PL')}] ${line}`),
    });
  } catch (err) {
    console.error(`Nie udało się uruchomić serwera: ${(err as Error).message}`);
    process.exitCode = 1;
    return;
  }

  if (dryRun) console.log('Tryb próbny — komputer nie zostanie wyłączony.');
  if (!command) console.log(`Uwaga: nieobsługiwany system (${process.platform}) — wyłączenie nie zadziała.`);
  console.log(`Shutdowner działa pod adresem:\n  ${server.url}`);
  console.log('Ctrl+C kończy program i anuluje odliczanie.');
  if (!(await openBrowser(process.platform, release(), server.url))) {
    console.log('Nie udało się otworzyć przeglądarki — otwórz powyższy link ręcznie.');
  }

  process.once('SIGINT', () => {
    console.log('\nZamykam, odliczanie anulowane.');
    void server.close().then(() => process.exit(130));
  });
}
