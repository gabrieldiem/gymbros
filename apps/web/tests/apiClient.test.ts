import { describe, expect, it, vi } from 'vitest';

import { ApiError, apiRequest } from '../src/api/client';
import { mockFetchJson } from './renderApp';

describe('apiRequest', () => {
  it('requests the /api path on the same origin with the session cookie', async () => {
    const fetchMock = mockFetchJson(200, { ok: true });
    await expect(apiRequest('/me')).resolves.toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('/api/me');
    expect(init).toMatchObject({ method: 'GET', credentials: 'same-origin' });
  });

  it('sends JSON bodies', async () => {
    const fetchMock = mockFetchJson(201, { id: 1 });
    await apiRequest('/things', { method: 'POST', body: { a: 1 } });
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.body).toBe('{"a":1}');
    expect(init?.headers).toMatchObject({ 'Content-Type': 'application/json' });
  });

  it('throws ApiError with the status and parsed body', async () => {
    mockFetchJson(422, { detail: 'bad' });
    const error = await apiRequest('/x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 422, body: { detail: 'bad' } });
  });

  it('accepts empty responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));
    await expect(apiRequest('/x', { method: 'DELETE' })).resolves.toBeNull();
  });
});
