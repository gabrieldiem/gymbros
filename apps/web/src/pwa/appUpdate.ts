/** Whether a new version of the app is waiting, and how to switch to it. */
let apply: (() => void) | null = null;
let atOpen = false;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((listener) => listener());

/** `whileOpening`: it was found as the app opened, so nothing has been lost by switching yet. */
export function announceUpdate(applyUpdate: () => void, whileOpening = false) {
  apply = applyUpdate;
  atOpen = whileOpening;
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

export const isUpdateReadyAtOpen = () => apply !== null && atOpen;

export const applyUpdate = () => apply?.();
