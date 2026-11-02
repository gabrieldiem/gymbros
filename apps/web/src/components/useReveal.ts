import { useEffect, useRef, type RefObject } from 'react';

/**
 * Plays a section's entrance when it scrolls into view, by setting `data-revealed`. Content is
 * visible until then, so anything that doesn't scroll (a crawler, print, no JavaScript) still
 * sees it.
 */
export function useReveal<T extends HTMLElement>(): RefObject<T | null> {
  const ref = useRef<T>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        element.dataset.revealed = 'true';
        observer.disconnect();
      },
      { threshold: 0.12 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return ref;
}
