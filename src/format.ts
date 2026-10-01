/** Picks the Polish plural form: 1 → one, 2–4 (except 12–14) → few, otherwise → many. */
export function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const lastDigit = n % 10;
  const lastTwo = n % 100;
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14)) return few;
  return many;
}

/** "1 minuta, 5 sekund" */
export function formatRemaining(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return (
    `${minutes} ${plural(minutes, 'minuta', 'minuty', 'minut')}, ` +
    `${seconds} ${plural(seconds, 'sekunda', 'sekundy', 'sekund')}`
  );
}

/** "5:07" or "1:02:03" */
export function formatClock(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const ss = String(seconds).padStart(2, '0');
  if (hours === 0) return `${minutes}:${ss}`;
  return `${hours}:${String(minutes).padStart(2, '0')}:${ss}`;
}
