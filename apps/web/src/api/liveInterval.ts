const NORMAL_MS = 20_000;
const LOW_DATA_MS = 120_000;
const STORAGE_KEY = 'gymbros.lowData';

type Connection = { saveData?: boolean; effectiveType?: string };

/** The member's own switch: uses less data on a weak connection. */
export const lowDataChosen = () => localStorage.getItem(STORAGE_KEY) === '1';

export function chooseLowData(on: boolean) {
  if (on) localStorage.setItem(STORAGE_KEY, '1');
  else localStorage.removeItem(STORAGE_KEY);
}

function connectionIsWeak(): boolean {
  const connection = (navigator as Navigator & { connection?: Connection }).connection;
  return Boolean(
    connection?.saveData || (connection?.effectiveType && connection.effectiveType.endsWith('2g')),
  );
}

/** How often live data refreshes: not at all offline, and rarely on a weak connection. */
export function liveInterval(): number | false {
  if (!navigator.onLine) return false;
  return lowDataChosen() || connectionIsWeak() ? LOW_DATA_MS : NORMAL_MS;
}
