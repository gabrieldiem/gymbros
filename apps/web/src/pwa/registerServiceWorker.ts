import { registerSW } from 'virtual:pwa-register';

import { announceUpdate } from './appUpdate';

const CHECK_EVERY_MS = 60 * 60 * 1000;

/**
 * Registers the service worker and looks for a new version every hour and whenever the app comes
 * back into view, since a phone can keep it open for days. A new version waits for the member to
 * reload, or for the next time the app is opened.
 */
export function registerServiceWorker() {
  const update = registerSW({
    onNeedRefresh: () => announceUpdate(() => void update(true)),
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
