import { createContext, useContext } from 'react';

export type ToastOptions = { alert?: boolean };
export type ShowToast = (message: string, options?: ToastOptions) => void;

export const ToastContext = createContext<ShowToast | null>(null);

/** Show a short message at the top of the screen. */
export function useToast(): ShowToast {
  const show = useContext(ToastContext);
  if (!show) throw new Error('useToast must be used inside <ToastProvider>');
  return show;
}
