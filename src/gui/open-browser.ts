import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { ShutdownCommand } from '../shutdown.ts';

/** Returns the command that opens a URL in the default browser, or null if unsupported. */
export function getOpenCommand(platform: NodeJS.Platform, release: string, url: string): ShutdownCommand | null {
  switch (platform) {
    case 'win32':
      // rundll32 instead of `cmd /c start`: no shell, so `&` or `#` in the URL can't be misinterpreted.
      return { file: 'rundll32.exe', args: ['url.dll,FileProtocolHandler', url] };
    case 'linux':
      // From WSL, open the browser on the Windows host.
      if (/microsoft/i.test(release)) return { file: 'rundll32.exe', args: ['url.dll,FileProtocolHandler', url] };
      return { file: 'xdg-open', args: [url] };
    case 'darwin':
      return { file: 'open', args: [url] };
    default:
      return null;
  }
}

/** Opens the URL in the default browser; resolves to false if that wasn't possible. */
export async function openBrowser(platform: NodeJS.Platform, release: string, url: string): Promise<boolean> {
  const command = getOpenCommand(platform, release, url);
  if (!command) return false;
  try {
    await promisify(execFile)(command.file, command.args);
    return true;
  } catch {
    return false;
  }
}
