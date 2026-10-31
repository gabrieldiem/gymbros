import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import styles from './Sheet.module.css';

type Props = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Hide the visual title (it still labels the dialog). */
  hideTitle?: boolean;
};

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** Modal bottom sheet (mobile) / centered dialog (≥700px). Esc and the scrim close it. */
export function Sheet({ title, onClose, children, hideTitle }: Props) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const first = panel.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel.current)?.focus();
    return () => opener?.focus();
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') trapFocus(event, panel.current);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return createPortal(
    <>
      <div className={styles.scrim} onClick={onClose} aria-hidden="true" />
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
