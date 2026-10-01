# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A small zero-dependency Node.js CLI that counts down and then powers off the machine. It is unrelated to the Glofox project described in the parent `../CLAUDE.md`; those business rules do not apply here.

## Commands

```bash
npm install                                  # dev tooling only; no runtime deps
node src/cli.ts --seconds 5 --dry-run        # safe manual run (prints the command instead of executing it)
npm test                                     # node:test, discovers test/*.test.ts
node --test test/args.test.ts                # single test file
node --test --test-name-pattern="plural"     # single test by name
npm run typecheck                            # tsc --noEmit
npm run lint                                 # eslint (flat config + typescript-eslint)
npm run format                               # prettier --write
```

**Never run the CLI without `--dry-run`.** It really shuts the machine down when the countdown hits zero.

## Architecture

- TypeScript runs directly on Node (native type stripping, Node ≥ 22.18). There is no build step, so only erasable TS syntax is allowed (`erasableSyntaxOnly`: no enums, namespaces or parameter properties). Imports use the `.ts` extension.
- `src/cli.ts` is the entry point and the only module with side effects: it wires the others together, handles TTY output, SIGINT (exit 130) and exit codes.
- `src/args.ts` parses argv with `node:util` `parseArgs` and returns a `run | help | error` union instead of throwing.
- `src/countdown.ts` derives the remaining time from a wall-clock deadline (no drift). It also holds the Polish plural formatting.
- `src/shutdown.ts` maps `process.platform` + `os.release()` to a power-off command. WSL is detected by `microsoft` in the release string and calls `shutdown.exe`. The command runs via `execFile`, with no shell.
- Tests mock `setInterval` and `Date` with `t.mock.timers`. Advance them one second per `tick()`, because a multi-second tick moves `Date` to the end before the callbacks run.
- User-facing strings are in Polish. Keep them that way.
