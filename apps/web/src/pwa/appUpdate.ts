/** Whether a new version of the app is waiting, and how to switch to it. */
let apply: (() => void) | null = null;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((listener) => listener());

export function announceUpdate(applyUpdate: () => void) {
  apply = applyUpdate;
  notify();
}

export function clearUpdate() {
  apply = null;
  notify();
}

export function subscribeToUpdate(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const isUpdateReady = () => apply !== null;

export const applyUpdate = () => apply?.();
