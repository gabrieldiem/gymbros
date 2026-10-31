import { useCallback, useEffect, useState } from 'react';

export const DEFAULT_REST_S = 90;

export type Rest = { endsAt: number; totalMs: number } | null;

/** A rest countdown started when a set is checked. Ticks 4× a second while running. */
export function useRestTimer(now: () => number = Date.now) {
  const [rest, setRest] = useState<Rest>(null);
  const [tick, setTick] = useState(now());

  useEffect(() => {
    if (!rest) return;
    const id = setInterval(() => setTick(now()), 250);
    return () => clearInterval(id);
  }, [rest, now]);

  const start = useCallback(
    (seconds = DEFAULT_REST_S) => {
      const at = now();
      setTick(at);
      setRest({ endsAt: at + seconds * 1000, totalMs: seconds * 1000 });
    },
    [now],
  );
  const adjust = useCallback(
    (seconds: number) =>
      setRest((r) =>
        r
          ? {
              endsAt: r.endsAt + seconds * 1000,
              totalMs: Math.max(1000, r.totalMs + seconds * 1000),
            }
          : r,
      ),
    [],
  );
  const skip = useCallback(() => setRest(null), []);

  const leftMs = rest ? Math.max(0, rest.endsAt - tick) : 0;
  return { rest, leftMs, start, adjust, skip };
}
