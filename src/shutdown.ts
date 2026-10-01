import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export interface ShutdownCommand {
  file: string;
  args: string[];
}

/** Returns the power-off command for the given platform, or null if unsupported. */
export function getShutdownCommand(platform: NodeJS.Platform, release: string): ShutdownCommand | null {
  switch (platform) {
    case 'win32':
      return { file: 'shutdown', args: ['/s', '/t', '0'] };
    case 'linux':
      // Inside WSL the Linux side can't power off the host; call the Windows binary instead.
      if (/microsoft/i.test(release)) return { file: 'shutdown.exe', args: ['/s', '/t', '0'] };
      return { file: 'systemctl', args: ['poweroff'] };
    case 'darwin':
      return { file: 'osascript', args: ['-e', 'tell app "System Events" to shut down'] };
    default:
      return null;
  }
}

export function formatCommand({ file, args }: ShutdownCommand): string {
  return [file, ...args.map((a) => (/\s/.test(a) ? `'${a}'` : a))].join(' ');
}

export async function runShutdown({ file, args }: ShutdownCommand): Promise<void> {
  await promisify(execFile)(file, args);
}
