import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { cx } from './cx';
import { ToastContext, type ToastOptions } from './toast';
import styles from './Toast.module.css';

const VISIBLE_MS = 3600;

type Toast = { id: number; message: string; alert: boolean };

/** One toast at a time, top centre, announced politely to screen readers. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const nextId = useRef(0);

  const show = useCallback((message: string, options: ToastOptions = {}) => {
    nextId.current += 1;
    setToast({ id: nextId.current, message, alert: Boolean(options.alert) });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), VISIBLE_MS);
    return () => clearTimeout(id);
  }, [toast]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div role="status" aria-live="polite">
        {toast && (
          <div key={toast.id} className={cx(styles.toast, toast.alert && styles.alert)}>
            {toast.message}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}
