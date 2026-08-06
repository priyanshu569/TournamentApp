import { useEffect, useState } from 'react';

// Re-renders whatever calls this every intervalMs, purely so a
// "Starting in X minutes" label counts down live instead of only
// updating on the next pull-to-refresh. Not a clock -- callers should
// still read Date.now() themselves each render, this just forces that
// render to happen.
export function useNow(intervalMs = 30000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

const SOON_WINDOW_MS = 30 * 60 * 1000;

// Only meaningful while a tournament is still 'upcoming' -- once a host
// marks it ongoing/completed this always returns null, regardless of
// how much time has actually passed, since the announced time is no
// longer the interesting fact at that point.
export function getStartingSoonLabel(startTime: string | null, status: string, now: number): string | null {
  if (status !== 'upcoming' || !startTime) return null;

  const diffMs = new Date(startTime).getTime() - now;
  if (diffMs > SOON_WINDOW_MS) return null;

  // Announced time has already passed and the host still hasn't started
  // it -- there's nothing sensible to count down to, so this stays a
  // static label for as long as that's true.
  if (diffMs <= 0) return 'Starting Soon';

  const minutes = Math.ceil(diffMs / 60000);
  if (minutes < 60) return `Starting in ${minutes} minute${minutes === 1 ? '' : 's'}`;

  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  return `Starting in ${hours}h ${remMinutes}m`;
}
