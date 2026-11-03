import { registerSW } from 'virtual:pwa-register';

import { announceUpdate } from './appUpdate';

const CHECK_EVERY_MS = 60 * 60 * 1000;
// A reload or a new visit looks for a new version, which takes a moment to download.
const OPENING_MS = 15_000;

/**
 * Registers the service worker and looks for a new version every hour and whenever the app comes
 * back into view, since a phone can keep it open for days. A version found while opening starts
 * right away (`ApplyUpdateOnOpen`), because a waiting service worker doesn't take over on a reload
 * by itself. One found later waits for the member (`UpdateBanner`).
 */
export function registerServiceWorker() {
  const update = registerSW({
    onNeedRefresh: () => announceUpdate(() => void update(true), performance.now() < OPENING_MS),
    onRegisteredSW: (_url, registration) => {
      if (!registration) return;
      const check = () => {
        if (navigator.onLine) void registration.update();
      };
      setInterval(check, CHECK_EVERY_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    },
  });
}
