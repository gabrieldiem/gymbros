import { useCallback, useEffect, useState } from 'react';

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

const DISMISSED_KEY = 'gymbros.installDismissed';

/** The browser's "Add to home screen" prompt, if it offered one and the user hasn't dismissed it. */
export function useInstallPrompt() {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISSED_KEY) === '1');

  useEffect(() => {
    const handleOffer = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
    };
    const handleInstalled = () => setEvent(null);
    window.addEventListener('beforeinstallprompt', handleOffer);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleOffer);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!event) return;
    await event.prompt();
    await event.userChoice;
    setEvent(null);
  }, [event]);

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISSED_KEY, '1');
    setDismissed(true);
  }, []);

  return { available: event !== null && !dismissed, install, dismiss };
}
