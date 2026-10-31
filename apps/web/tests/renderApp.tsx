import { QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';

import type { Me } from '../src/api/types';
import { App } from '../src/App';
import { Providers } from '../src/Providers';

/** Render the whole app at `path`, with a fresh query client that never retries. */
export function renderApp(path: string | { pathname: string; state?: unknown } = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <Providers client={client}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </Providers>,
  );
  return { ...view, client };
}

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function mockFetchJson(status: number, body: unknown) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async () => jsonResponse(status, body));
}

type Reply = [number, unknown] | ((body: unknown) => [number, unknown]);

/**
 * Route fetch calls by "METHOD /api/path". Unlisted routes answer 404, except /api/health,
 * which is always up. Returns the spy so tests can inspect calls.
 */
export function mockApi(routes: Record<string, Reply>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const key = `${init?.method ?? 'GET'} ${String(input)}`;
    if (key === 'GET /api/health') return jsonResponse(200, { status: 'running', database: 'up' });
    const reply = routes[key];
    if (!reply) return jsonResponse(404, { detail: 'Not Found' });
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined;
    const [status, payload] = typeof reply === 'function' ? reply(body) : reply;
    return jsonResponse(status, payload);
  });
}

export const CREW = {
  id: 'c1',
  name: 'Iron Ridge',
  time_zone: 'America/Argentina/Buenos_Aires',
  invite_code: 'IRONRIDGE',
};

export function makeMe(overrides: Partial<Me> = {}): Me {
  return {
    id: 'u1',
    email: 'gabi@example.com',
    display_name: 'Gabi',
    initials: 'GA',
    color: 'volt',
    language: 'en',
    rest_seconds: 90,
    crew: CREW,
    ...overrides,
  };
}

export const SIGNED_OUT: [number, unknown] = [401, { detail: { code: 'not_authenticated' } }];
