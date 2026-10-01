import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatCommand, getShutdownCommand } from '../src/shutdown.ts';

test('picks the command for each platform', () => {
  assert.deepEqual(getShutdownCommand('win32', '10.0.22631'), { file: 'shutdown', args: ['/s', '/t', '0'] });
  assert.deepEqual(getShutdownCommand('linux', '6.8.0-45-generic'), { file: 'systemctl', args: ['poweroff'] });
  assert.deepEqual(getShutdownCommand('linux', '6.18.40.1-microsoft-standard-WSL2'), {
    file: 'shutdown.exe',
    args: ['/s', '/t', '0'],
  });
  assert.equal(getShutdownCommand('darwin', '24.0.0')?.file, 'osascript');
  assert.equal(getShutdownCommand('aix', '7.2'), null);
});

test('formats a command for display', () => {
  const mac = getShutdownCommand('darwin', '24.0.0');
  assert.ok(mac);
  assert.equal(formatCommand(mac), `osascript -e 'tell app "System Events" to shut down'`);
});
