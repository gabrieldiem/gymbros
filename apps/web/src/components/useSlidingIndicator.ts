import { useLayoutEffect, useRef, type RefObject } from 'react';

/**
 * Keeps an indicator on the active item of a nav. Sets `--ind-x`, `--ind-y`, `--ind-w`, `--ind-h`
 * and `--ind-on` on the container, for CSS to place and animate it. `selector` finds the active
 * item; `key` should change whenever it might have moved (the route, the language).
 */
export function useSlidingIndicator<T extends HTMLElement>(
  selector: string,
  key: string,
): RefObject<T | null> {
  const container = useRef<T>(null);

  useLayoutEffect(() => {
    const root = container.current;
    if (!root) return;
    const place = () => {
      const active = root.querySelector<HTMLElement>(selector);
      root.style.setProperty('--ind-on', active ? '1' : '0');
      if (!active) return;
      root.style.setProperty('--ind-x', `${active.offsetLeft}px`);
      root.style.setProperty('--ind-y', `${active.offsetTop}px`);
      root.style.setProperty('--ind-w', `${active.offsetWidth}px`);
      root.style.setProperty('--ind-h', `${active.offsetHeight}px`);
    };
    place();
    if (typeof ResizeObserver === 'undefined') return;
    // The layout changes between dock and rail, and web fonts change label widths.
    const observer = new ResizeObserver(place);
    observer.observe(root);
    return () => observer.disconnect();
  }, [selector, key]);

  return container;
}
