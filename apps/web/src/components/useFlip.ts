import { useLayoutEffect, useRef, type RefObject } from 'react';

const reducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * Animate a list's items to their new places when the order changes. Items need
 * `data-flip-id`. Measures before and after each render, then slides from the old spot.
 */
export function useFlip<T extends HTMLElement>(order: string): RefObject<T | null> {
  const container = useRef<T>(null);
  const previous = useRef(new Map<string, number>());

  useLayoutEffect(() => {
    const root = container.current;
    if (!root) return;
    const items = [...root.querySelectorAll<HTMLElement>('[data-flip-id]')];
    const tops = new Map(
      items.map((item) => [item.dataset.flipId ?? '', item.getBoundingClientRect().top]),
    );
    if (!reducedMotion()) {
      for (const item of items) {
        const before = previous.current.get(item.dataset.flipId ?? '');
        const after = tops.get(item.dataset.flipId ?? '');
        if (before === undefined || after === undefined || before === after) continue;
        item.animate?.([{ transform: `translateY(${before - after}px)` }, { transform: 'none' }], {
          duration: 500,
          easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        });
      }
    }
    previous.current = tops;
  }, [order]);

  return container;
}
