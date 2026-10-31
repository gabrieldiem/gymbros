import { useEffect, useRef, useState } from 'react';

const reducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const easeInOutCubic = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

type Options = {
  /** Where markers start the first time they appear (0 = the intro climb from Rookie). */
  introFrom: number;
  /** Override the start for some markers (your marker after a finish). */
  startFrom?: Record<string, number> | undefined;
  durationMs: number;
  delayMs?: number | undefined;
  onDone?: (() => void) | undefined;
};

/**
 * Animated trail fractions per marker id. Markers glide from where they were to `targets`
 * whenever the targets change; with reduced motion they jump straight there.
 */
export function useClimbAnimation(targets: Record<string, number>, options: Options) {
  const [shown, setShown] = useState<Record<string, number>>(() =>
    reducedMotion() ? targets : startPositions(targets, {}, options),
  );
  const current = useRef(shown);
  const key = JSON.stringify(targets);
  const optionsRef = useRef(options);
  const reduced = reducedMotion();

  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    const opts = optionsRef.current;
    if (reducedMotion()) {
      current.current = targets;
      opts.onDone?.();
      return;
    }
    const from = startPositions(targets, current.current, opts);
    let frame = 0;
    let start = 0;
    const step = (now: number) => {
      start ||= now;
      const k = Math.min(1, (now - start) / opts.durationMs);
      const e = easeInOutCubic(k);
      const next = Object.fromEntries(
        Object.entries(targets).map(([id, to]) => [
          id,
          (from[id] ?? to) + (to - (from[id] ?? to)) * e,
        ]),
      );
      current.current = next;
      setShown(next);
      if (k < 1) frame = requestAnimationFrame(step);
      else opts.onDone?.();
    };
    const timer = setTimeout(() => (frame = requestAnimationFrame(step)), opts.delayMs ?? 0);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
    // `key` captures every change of `targets`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return reduced ? targets : shown;
}

function startPositions(
  targets: Record<string, number>,
  current: Record<string, number>,
  options: Options,
): Record<string, number> {
  return Object.fromEntries(
    Object.keys(targets).map((id) => [
      id,
      options.startFrom?.[id] ?? current[id] ?? options.introFrom,
    ]),
  );
}
