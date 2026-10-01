import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseArgs } from '../src/args.ts';

const total = (argv: string[]) => {
  const result = parseArgs(argv);
  assert.equal(result.kind, 'run');
  return result.kind === 'run' ? result.options.totalSeconds : NaN;
};

const isError = (argv: string[]) => assert.equal(parseArgs(argv).kind, 'error');

test('combines minutes and seconds', () => {
  assert.equal(total(['--minutes', '2', '--seconds', '30']), 150);
  assert.equal(total(['-m', '1', '-s', '5']), 65);
});

test('accepts seconds alone and zero minutes', () => {
  assert.equal(total(['--seconds', '30']), 30);
  assert.equal(total(['--minutes', '0', '--seconds', '30']), 30);
});

test('rounds fractional input to whole seconds', () => {
  assert.equal(total(['--minutes', '1.5']), 90);
  assert.equal(total(['--minutes', '0.01']), 1);
});

test('rejects invalid values', () => {
  isError([]);
  isError(['--minutes', '0']);
  isError(['--minutes', 'abc']);
  isError(['--seconds', 'abc']);
  isError(['--seconds', '-5']);
  isError(['--minutes', '']);
  isError(['--minutes', 'Infinity']);
  isError(['--seconds', '0.2']);
  isError(['--unknown']);
  isError(['5']);
});

test('parses --dry-run and --help', () => {
  const result = parseArgs(['-s', '3', '--dry-run']);
  assert.deepEqual(result, { kind: 'run', options: { totalSeconds: 3, dryRun: true } });
  assert.equal(parseArgs(['--help']).kind, 'help');
});
