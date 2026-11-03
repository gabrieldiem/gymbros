import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import styles from './Sheet.module.css';
import { useKeyboardFit } from './useKeyboardFit';

type Props = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Hide the visual title (it still labels the dialog). */
  hideTitle?: boolean;
};

const EXIT_MS = 220;
const openSheets: HTMLElement[] = [];

const reducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * Sheets close through many paths (a button inside, Esc, the parent unmounting), so the exit is
 * played by a brief, inert copy left on screen when the real one unmounts.
 */
function playExit(panel: HTMLElement, scrim: HTMLElement) {
  if (reducedMotion() || typeof panel.animate !== 'function') return;
  const wide = window.matchMedia?.('(min-width: 700px)').matches ?? false;
  const panelCopy = panel.cloneNode(true) as HTMLElement;
  const scrimCopy = scrim.cloneNode(true) as HTMLElement;
  for (const copy of [panelCopy, scrimCopy]) {
    copy.removeAttribute('id');
    copy.removeAttribute('role');
    copy.removeAttribute('aria-modal');
    copy.removeAttribute('aria-labelledby');
    copy.setAttribute('aria-hidden', 'true');
    copy.setAttribute('inert', '');
    copy.style.pointerEvents = 'none';
    copy.style.animation = 'none';
    document.body.append(copy);
  }
  panelCopy.scrollTop = panel.scrollTop;
  const end = wide
    ? { opacity: 0, transform: 'translate(-50%, -50%) scale(0.97)' }
    : { transform: 'translateY(100%)' };
  const timing = { duration: EXIT_MS, easing: 'ease-in', fill: 'forwards' } as const;
  panelCopy.animate([{}, end], timing).onfinish = () => panelCopy.remove();
  scrimCopy.animate([{}, { opacity: 0 }], timing).onfinish = () => scrimCopy.remove();
}

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** Modal bottom sheet (mobile) / centered dialog (≥700px). Esc and the scrim close it. */
export function Sheet({ title, onClose, children, hideTitle }: Props) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  useKeyboardFit(panel);

  useEffect(() => {
    const panelElement = panel.current;
    const scrimElement = scrim.current;
    const openedAt = performance.now();
    return () => {
      // React's development double-mount closes it instantly: nothing was shown, so skip it.
      if (panelElement && scrimElement && performance.now() - openedAt > 100) {
        playExit(panelElement, scrimElement);
      }
    };
  }, []);

  useEffect(() => {
    // Everything behind the sheet is inert: no focus, clicks or screen-reader reading leak out.
    const root = document.getElementById('root');
    const element = panel.current as HTMLElement;
    root?.setAttribute('inert', '');
    openSheets.push(element);
    return () => {
      openSheets.splice(openSheets.indexOf(element), 1);
      // A sheet opened from a sheet leaves the page inert for the one still open.
      if (openSheets.length === 0) root?.removeAttribute('inert');
    };
  }, []);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const first = panel.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel.current)?.focus();
    return () => opener?.focus();
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      // A sheet opened from a sheet: only the one on top answers.
      if (openSheets[openSheets.length - 1] !== panel.current) return;
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') trapFocus(event, panel.current);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return createPortal(
    <>
      <div ref={scrim} className={styles.scrim} onClick={onClose} aria-hidden="true" />
      <div
        ref={panel}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className={styles.grab} aria-hidden="true" />
        <h2 id={titleId} className={hideTitle ? 'sr-only' : undefined}>
          {title}
        </h2>
        {children}
      </div>
    </>,
    document.body,
  );
}

function trapFocus(event: KeyboardEvent, container: HTMLElement | null) {
  const items = container ? [...container.querySelectorAll<HTMLElement>(FOCUSABLE)] : [];
  const first = items[0];
  const last = items[items.length - 1];
  if (!first || !last) return;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
