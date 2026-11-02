import { useEffect, type RefObject } from 'react';

/**
 * Keeps a bottom sheet above the on-screen keyboard, which covers the page without resizing it on
 * most phones. The visual viewport is the only thing that knows how tall the keyboard is.
 */
export function useKeyboardFit(panel: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const viewport = window.visualViewport;
    const element = panel.current;
    if (!viewport || !element) return;
    const fit = () => {
      const covered = window.innerHeight - viewport.height - viewport.offsetTop;
      element.style.setProperty('--keyboard', `${Math.max(0, covered)}px`);
      element.style.setProperty('--viewport-h', `${viewport.height}px`);
    };
    fit();
    viewport.addEventListener('resize', fit);
    viewport.addEventListener('scroll', fit);
    return () => {
      viewport.removeEventListener('resize', fit);
      viewport.removeEventListener('scroll', fit);
    };
  }, [panel]);
}
