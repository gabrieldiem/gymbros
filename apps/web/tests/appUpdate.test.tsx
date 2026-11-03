import { act, screen, waitFor } from '@testing-library/react';
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

describe('A new version found while the app opens', () => {
  afterEach(() => {
    clearUpdate();
    sessionStorage.clear();
  });

  it('starts by itself, so a normal reload gets it', async () => {
    await openApp();
    const apply = vi.fn();
    act(() => announceUpdate(apply, true));
    await waitFor(() => expect(apply).toHaveBeenCalledOnce());
  });

  it('starts for someone signed out too, without asking for their workout', async () => {
    const fetchMock = mockApi({ 'GET /api/me': [401, { detail: { code: 'not_authenticated' } }] });
    renderApp('/login');
    await screen.findByRole('heading', { level: 1 });
    const apply = vi.fn();
    act(() => announceUpdate(apply, true));
    await waitFor(() => expect(apply).toHaveBeenCalledOnce());
    expect(fetchMock.mock.calls.map(([url]) => String(url))).not.toContain('/api/workouts/active');
  });

  it('waits while a workout is in progress', async () => {
    await openApp(makeWorkout());
    await screen.findByRole('link', { name: /Back to your workout/ });
    const apply = vi.fn();
    act(() => announceUpdate(apply, true));
    await act(() => new Promise((done) => setTimeout(done, 50)));
    expect(apply).not.toHaveBeenCalled();
  });

  it('never reloads in a loop if it fails to take over', async () => {
    await openApp();
    const apply = vi.fn();
    act(() => announceUpdate(apply, true));
    await waitFor(() => expect(apply).toHaveBeenCalledOnce());
    act(() => clearUpdate());
    act(() => announceUpdate(apply, true));
    await act(() => new Promise((done) => setTimeout(done, 50)));
    expect(apply).toHaveBeenCalledOnce();
  });
});

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
