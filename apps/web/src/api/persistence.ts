import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import type { Query } from '@tanstack/react-query';

const A_WEEK_MS = 7 * 24 * 3_600_000;

/** What the app needs to open and log a workout with no signal. */
const KEPT: readonly (readonly string[])[] = [
  ['me'],
  ['me', 'gyms'],
  ['catalog'],
  ['workout', 'active'],
  ['workout', 'week'],
  ['workout', 'templates'],
];

export function isKeptOnPhone(key: readonly unknown[]): boolean {
  if (key[0] === 'climb') return true;
  return KEPT.some(
    (kept) => kept.length === key.length && kept.every((part, i) => part === key[i]),
  );
}

/**
 * Anything with data, whatever its last fetch did. With no signal every refresh fails, and that
 * mustn't throw away what the phone needs for the next time the app opens.
 *
 * Being signed out is never kept. Coming back from Google's sign-in, it would send you away from
 * the page you asked for before the server could say you're signed in.
 */
export function shouldKeepQuery(query: Pick<Query, 'state' | 'queryKey'>): boolean {
  const signedOut = query.queryKey.length === 1 && query.queryKey[0] === 'me' && !query.state.data;
  return query.state.data !== undefined && !signedOut && isKeptOnPhone(query.queryKey);
}

export const persistOptions = {
  persister: createSyncStoragePersister({
    storage: typeof window === 'undefined' ? undefined : window.localStorage,
    key: 'gymbros.cache',
    throttleTime: 300,
  }),
  maxAge: A_WEEK_MS,
  dehydrateOptions: {
    shouldDehydrateQuery: shouldKeepQuery,
  },
};
