# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A small zero-dependency Node.js CLI that counts down and then powers off the machine, either in the terminal or with `--gui` (a local web page served by the same process). It is unrelated to the Glofox project described in the parent `../CLAUDE.md`; those business rules do not apply here.

## Commands

```bash
npm install                                  # dev tooling only; no runtime deps
node src/cli.ts --seconds 5 --dry-run        # safe manual run (prints the command instead of executing it)
node src/cli.ts --gui --dry-run              # safe GUI run (npm run gui:dry); opens the default browser
npm test                                     # node:test, discovers test/*.test.ts
node --test test/args.test.ts                # single test file
node --test --test-name-pattern="plural"     # single test by name
npm run typecheck                            # tsc --noEmit
npm run lint                                 # eslint (flat config + typescript-eslint)
npm run format                               # prettier --write
```

**Never run the CLI without `--dry-run`.** It really shuts the machine down when the countdown hits zero. `--gui` opens a browser tab on the user's desktop every time it starts.

## Architecture

- TypeScript runs directly on Node (native type stripping, Node ≥ 22.18). There is no build step, so only erasable TS syntax is allowed (`erasableSyntaxOnly`: no enums, namespaces or parameter properties). Imports use the `.ts` extension.
- `src/cli.ts` is the entry point and the only module with side effects: it wires the others together, handles TTY output, SIGINT (exit 130) and exit codes.
- `src/args.ts` parses argv with `node:util` `parseArgs` and returns a `run | help | error` union instead of throwing.
- `src/timer.ts` is a pure state machine (`idle | running | paused | done`) driven by a wall-clock deadline. Ticks are scheduled on whole-second boundaries, and `onDone` fires once. Both the terminal mode and the GUI use it.
- `src/format.ts` holds the Polish plural forms and the `m:ss` clock.
- **`src/timer.ts`, `src/format.ts` and `src/shutdown.ts` are identical copies of the same files in `~/repos/shutdowner-electron-app/src/`.** Change them in both repos together, tests included.
- `src/gui/server.ts` is a `node:http` server that owns the timer. It serves `public/` (fixed allowlist), a JSON API under `/api` and a Server-Sent Events stream (`/api/events`) that broadcasts state, with ready-made `clock`/`caption` texts, to every open tab. `public/app.js` is a plain `// @ts-check` remote control with no timing or formatting logic. tsc checks it via `allowJs`/`checkJs`.
- **GUI security model:** the server can power off the machine and any website can send requests to localhost, so every layer matters:
  - binds to `127.0.0.1` only,
  - checks the `Host` header (DNS rebinding) and `Origin` on POST,
  - requires a per-run random token on every `/api` call. The token travels in the URL fragment (`#t=`), then in the `X-Token` header. `/api/events` takes it as a query parameter because EventSource can't set headers.
  - `/api/start` requires a JSON content type, so a cross-site request always needs a CORS preflight, which the server never grants.
  - strict CSP.
    Don't weaken any of these.
- `src/gui/open-browser.ts` opens the URL with `rundll32 url.dll,FileProtocolHandler` on Windows/WSL (no shell, so `#`/`&` are safe), `xdg-open` on Linux and `open` on macOS.
- `src/shutdown.ts` maps `process.platform` + `os.release()` to a power-off command. WSL is detected by `microsoft` in the release string and calls `shutdown.exe`. The command runs via `execFile`, with no shell.
- `test/server.test.ts` runs the real server on port 0 with a fake `runShutdown` and reads the SSE stream. Timer tests mock `setTimeout` and `Date` with `t.mock.timers`. Advance them one second per `tick()`, because a multi-second tick moves `Date` to the end before the callbacks run.
- User-facing strings are in Polish. Keep them that way.
