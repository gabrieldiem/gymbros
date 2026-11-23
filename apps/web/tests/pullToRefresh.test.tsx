import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { canStartPull, PULL_TRIGGER, pullOffset } from '../src/components/pull';
import { makeMe, mockApi, renderApp } from './renderApp';

describe('pull to refresh rules', () => {
  it('moves slower than the finger and stops at a cap', () => {
    expect(pullOffset(-20)).toBe(0);
    expect(pullOffset(60)).toBe(30);
    expect(pullOffset(1000)).toBeLessThan(150);
    expect(pullOffset(1000)).toBeGreaterThanOrEqual(PULL_TRIGGER);
  });

  it('starts only at the top of the page and outside sheets and maps', () => {
    const root = document.createElement('div');
    root.id = 'root';
    root.innerHTML =
      '<p id="page">x</p><div role="dialog"><p id="sheet">x</p></div><div class="leaflet-container"><p id="map">x</p></div>';
    document.body.append(root);
    const at = (id: string) => document.getElementById(id);
    expect(canStartPull(at('page'), 0)).toBe(true);
    expect(canStartPull(at('page'), 120)).toBe(false);
    expect(canStartPull(at('sheet'), 0)).toBe(false);
    expect(canStartPull(at('map'), 0)).toBe(false);
    root.remove();
  });
});

describe('pull to refresh on a phone', () => {
  const pull = (target: Element, dy: number) => {
    fireEvent.touchStart(target, { touches: [{ clientY: 100 }] });
    fireEvent.touchMove(target, { touches: [{ clientY: 100 + dy }] });
    fireEvent.touchEnd(target, { touches: [] });
  };
  const feedCalls = (fetchMock: ReturnType<typeof mockApi>) =>
    fetchMock.mock.calls.filter(([url]) => String(url).startsWith('/api/feed')).length;

  it('fetches what is on screen again after a long enough pull', async () => {
    const fetchMock = mockApi({
      'GET /api/me': [200, makeMe()],
      'GET /api/feed': [200, { items: [], next_before: null, next_before_id: null }],
    });
    renderApp('/crew');
    const heading = await screen.findByRole('heading', { level: 1, name: 'Activity' });
    await waitFor(() => expect(feedCalls(fetchMock)).toBeGreaterThan(0));
    const before = feedCalls(fetchMock);

    pull(heading, 40); // Too short: nothing happens.
    expect(feedCalls(fetchMock)).toBe(before);

    pull(heading, 300);
    await waitFor(() => expect(feedCalls(fetchMock)).toBeGreaterThan(before));
  });
});
