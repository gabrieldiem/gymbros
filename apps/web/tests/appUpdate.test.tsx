import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { announceUpdate, clearUpdate } from '../src/pwa/appUpdate';
import { makeMe, mockApi, renderApp } from './renderApp';
import { makeWorkout } from './trainFixtures';

const banner = () => screen.queryByRole('complementary', { name: 'New version ready' });

async function openApp(workout: unknown = null) {
  mockApi({ 'GET /api/me': [200, makeMe()], 'GET /api/workouts/active': [200, workout] });
  renderApp('/me');
  await screen.findByRole('button', { name: /^Alerts/ });
}

describe('New version banner', () => {
  afterEach(() => clearUpdate());

  it('stays away until a new version is ready', async () => {
    await openApp();
    expect(banner()).toBeNull();
  });

  it('reloads into the new version when asked', async () => {
    await openApp();
    const apply = vi.fn();
    act(() => announceUpdate(apply));
    expect(apply).not.toHaveBeenCalled();
    await userEvent.click(await screen.findByRole('button', { name: 'Reload' }));
    expect(apply).toHaveBeenCalledOnce();
  });

  it('goes away with Later, without updating', async () => {
    await openApp();
    const apply = vi.fn();
    act(() => announceUpdate(apply));
    await userEvent.click(await screen.findByRole('button', { name: 'Later' }));
    expect(banner()).toBeNull();
    expect(apply).not.toHaveBeenCalled();
  });

  it('waits while a workout is in progress', async () => {
    await openApp(makeWorkout());
    await screen.findByRole('link', { name: /Back to your workout/ });
    act(() => announceUpdate(vi.fn()));
    expect(banner()).toBeNull();
  });
});
