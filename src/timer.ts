export type TimerState =
  | { status: 'idle' }
  | { status: 'running' | 'paused'; remaining: number; total: number }
  | { status: 'done'; total: number };

export interface TimerOptions {
  onChange: (state: TimerState) => void;
  onDone: () => void;
}

export interface Timer {
  start: (totalSeconds: number) => void;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
  getState: () => TimerState;
}

/**
 * Countdown driven by a wall-clock deadline, so throttled or late timers never stretch it.
 * Ticks land on whole-second boundaries of the remaining time (also after resuming from a pause).
 * onDone fires exactly once per started countdown.
 */
export function createTimer({ onChange, onDone }: TimerOptions): Timer {
  let state: TimerState = { status: 'idle' };
  let deadline = 0;
  let pausedMs = 0;
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const set = (next: TimerState) => {
    state = next;
    onChange(state);
  };

  const clear = () => {
    clearTimeout(timeout);
    timeout = undefined;
  };

  const tick = () => {
    if (state.status !== 'running') return;
    const ms = deadline - Date.now();
    if (ms <= 0) {
      clear();
      set({ status: 'done', total: state.total });
      onDone();
      return;
    }
    set({ status: 'running', remaining: Math.ceil(ms / 1000), total: state.total });
    timeout = setTimeout(tick, ms % 1000 || 1000);
  };

  const run = (ms: number, total: number) => {
    clear();
    deadline = Date.now() + ms;
    state = { status: 'running', remaining: Math.ceil(ms / 1000), total };
    tick();
  };

  return {
    start(totalSeconds) {
      if (!Number.isInteger(totalSeconds) || totalSeconds <= 0) {
        throw new RangeError(`Invalid countdown length: ${totalSeconds}`);
      }
      run(totalSeconds * 1000, totalSeconds);
    },
    pause() {
      if (state.status !== 'running') return;
      clear();
      // Keep the exact remainder (not rounded seconds) so resume() continues where we stopped.
      pausedMs = Math.max(0, deadline - Date.now());
      set({ status: 'paused', remaining: Math.ceil(pausedMs / 1000), total: state.total });
    },
    resume() {
      if (state.status !== 'paused') return;
      run(pausedMs, state.total);
    },
    cancel() {
      clear();
      if (state.status !== 'idle') set({ status: 'idle' });
    },
    getState: () => state,
  };
}
