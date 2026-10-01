/** Picks the Polish plural form: 1 → one, 2–4 (except 12–14) → few, otherwise → many. */
function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const lastDigit = n % 10;
  const lastTwo = n % 100;
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14)) return few;
  return many;
}

export function formatRemaining(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return (
    `Komputer wyłączy się za: ${minutes} ${plural(minutes, 'minuta', 'minuty', 'minut')}, ` +
    `${seconds} ${plural(seconds, 'sekunda', 'sekundy', 'sekund')}`
  );
}

export interface CountdownOptions {
  totalSeconds: number;
  onTick: (remainingSeconds: number) => void;
  onDone: () => void;
}

/**
 * Ticks once per second until the deadline, then calls onDone exactly once.
 * Remaining time is derived from the wall clock, so interval drift doesn't accumulate.
 * Returns a function that cancels the countdown.
 */
export function startCountdown({ totalSeconds, onTick, onDone }: CountdownOptions): () => void {
  const deadline = Date.now() + totalSeconds * 1000;

  const tick = () => {
    const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    onTick(remaining);
    if (remaining === 0) {
      clearInterval(timer);
      onDone();
    }
  };

  const timer = setInterval(tick, 1000);
  tick();
  return () => clearInterval(timer);
}
