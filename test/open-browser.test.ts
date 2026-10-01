import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getOpenCommand } from '../src/gui/open-browser.ts';

const url = 'http://127.0.0.1:4321/#t=abc&x=1';

test('picks the browser opener for each platform', () => {
  const windows = { file: 'rundll32.exe', args: ['url.dll,FileProtocolHandler', url] };
  assert.deepEqual(getOpenCommand('win32', '10.0.22631', url), windows);
  assert.deepEqual(getOpenCommand('linux', '6.18.40.1-microsoft-standard-WSL2', url), windows);
  assert.deepEqual(getOpenCommand('linux', '6.8.0-45-generic', url), { file: 'xdg-open', args: [url] });
  assert.deepEqual(getOpenCommand('darwin', '24.0.0', url), { file: 'open', args: [url] });
  assert.equal(getOpenCommand('aix', '7.2', url), null);
});
