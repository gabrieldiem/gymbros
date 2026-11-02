import { useEffect, useRef, useState } from 'react';

const reducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const easeOut = (k: number) => 1 - Math.pow(1 - k, 3);

/** A number that counts from its last value to `value`. Reduced motion shows it straight away. */
export function CountUp({
  value,
  format = String,
  durationMs = 900,
}: {
  value: number;
  format?: (value: number) => string;
  durationMs?: number;
}) {
  const [shown, setShown] = useState(() => (reducedMotion() ? value : 0));
  const from = useRef(shown);

  useEffect(() => {
    if (reducedMotion() || typeof requestAnimationFrame === 'undefined') {
      setShown(value);
      return;
    }
    const start = from.current;
    const began = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const progress = Math.min(1, (now - began) / durationMs);
      const next = Math.round(start + (value - start) * easeOut(progress));
      from.current = next;
      setShown(next);
      if (progress < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [value, durationMs]);

  return <span>{format(shown)}</span>;
}
