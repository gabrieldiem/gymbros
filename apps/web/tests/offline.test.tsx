import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { climbKey } from '../src/api/climb';
import { gymsKey } from '../src/api/gyms';
import { liveInterval, chooseLowData } from '../src/api/liveInterval';
import { meKey } from '../src/api/me';
import { isKeptOnPhone, shouldKeepQuery } from '../src/api/persistence';
import { feedKey, inboxKey } from '../src/api/social';
import { activeWorkoutKey, catalogKey, templatesKey, weekKey } from '../src/api/train';
import { buildLocalWorkout, hasCompletedSet, toQueued } from '../src/features/train/localWorkout';
import {
  addToOutbox,
  clearOfflineData,
  getOutbox,
  loadDraft,
  loadLocalWorkout,
  markFailed,
  removeFromOutbox,
  saveDraft,
  saveLocalWorkout,
  type QueuedWorkout,
} from '../src/features/train/offlineStore';
import { makeMe, mockApi, renderApp } from './renderApp';
import { CATALOG, FINISHED, makeWorkout } from './trainFixtures';

const WEEK = {
  workouts: 1,
  target: 3,
  leg_event_active: false,
  event_ends_at: null,
  past_days: [],
};
const NO_SIGNAL = (): [number, unknown] => {
  throw new TypeError('Failed to fetch');
};
const DONE = { load_kg: 60, bar_kg: 20, reps: 5, minutes: null, km: null, done: true };
const QUEUED: QueuedWorkout = {
  id: 'w9',
  routine_id: 'push',
  name: 'Push day',
  gym: null,
  performed_on: null,
  started_at: '2026-11-02T10:00:00Z',
  finished_at: '2026-11-02T11:00:00Z',
  exercises: [{ exercise_id: 'bench', sets: [DONE] }],
};

function trainApi(routes: Parameters<typeof mockApi>[0] = {}) {
  return mockApi({
    'GET /api/me': [200, makeMe()],
    'GET /api/catalog': [200, CATALOG],
    'GET /api/workouts/week': [200, WEEK],
    'GET /api/workouts/active': [200, null],
    ...routes,
  });
}

beforeEach(() => clearOfflineData());
afterEach(() => clearOfflineData());

describe('What waits on this phone', () => {
  it('keeps a finished workout through a reload of the store', () => {
    addToOutbox(QUEUED);
    expect(JSON.parse(localStorage.getItem('gymbros.offline.outbox') ?? '[]')).toEqual([QUEUED]);
    removeFromOutbox('w9');
    expect(getOutbox()).toEqual([]);
  });

  it('never holds the same workout twice', () => {
    addToOutbox(QUEUED);
    addToOutbox({ ...QUEUED, name: 'Again' });
    expect(getOutbox().map((w) => w.name)).toEqual(['Again']);
  });

  it('marks one the server refused', () => {
    addToOutbox(QUEUED);
    markFailed('w9');
    expect(getOutbox()[0]?.failed).toBe(true);
  });

  it('leaves nothing behind when you sign out', () => {
    addToOutbox(QUEUED);
    saveLocalWorkout(makeWorkout({ local: true }));
    saveDraft('w1', { name: 'x', gym: null, exercises: [] });
    clearOfflineData();
    expect(getOutbox()).toEqual([]);
    expect(loadLocalWorkout()).toBeNull();
    expect(loadDraft('w1')).toBeNull();
  });
});

describe('A workout built with no signal', () => {
  const body = { routine_id: 'push' };

  it('starts from what the phone already has, loaded to beat last time', () => {
    const template = {
      routine_id: 'push',
      name: 'Push day',
      exercises: [{ exercise_id: 'bench', sets: [DONE], previous_sets: [DONE] }],
    };
    const workout = buildLocalWorkout(body, CATALOG, [template], 'Smart Fit', new Date(0));
    expect(workout.local).toBe(true);
    expect(workout.name).toBe('Push day');
    expect(workout.gym).toBe('Smart Fit');
    expect(workout.exercises[0]?.sets[0]?.load_kg).toBe(60);
  });

  it('still starts with only the catalog', () => {
    const workout = buildLocalWorkout(body, CATALOG, undefined, null, new Date(0));
    expect(workout.exercises[0]?.exercise_id).toBe('bench');
    expect(workout.exercises[0]?.sets).toHaveLength(3);
  });

  it('gets its own id each time', () => {
    const one = buildLocalWorkout(body, CATALOG, undefined, null, new Date(0));
    const two = buildLocalWorkout(body, CATALOG, undefined, null, new Date(0));
    expect(one.id).not.toBe(two.id);
  });

  it('goes out as a whole, without what the server worked out', () => {
    const workout = makeWorkout({ id: 'x', started_at: '2026-11-02T10:00:00Z' });
    const draft = {
      name: ' Mine ',
      gym: 'Home',
      exercises: [{ exercise_id: 'bench', sets: [DONE], previous_sets: [DONE] }],
    };
    const queued = toQueued(workout, draft, new Date('2026-11-02T11:00:00Z'));
    expect(queued).toMatchObject({
      id: 'x',
      name: 'Mine',
      gym: 'Home',
      finished_at: '2026-11-02T11:00:00.000Z',
      exercises: [{ exercise_id: 'bench', sets: [DONE] }],
    });
    expect(queued.exercises[0]).not.toHaveProperty('previous_sets');
  });

  it('knows when there is nothing to finish', () => {
    const empty = { ...DONE, done: false };
    const draft = (set: typeof DONE) => ({
      name: 'x',
      gym: null,
      exercises: [{ exercise_id: 'bench', sets: [set], previous_sets: [] }],
    });
    expect(hasCompletedSet(draft(DONE))).toBe(true);
    expect(hasCompletedSet(draft(empty))).toBe(false);
  });
});

describe('Train with no signal', () => {
  it('starts a routine anyway, from what the phone has', async () => {
    trainApi({ 'POST /api/workouts': NO_SIGNAL });
    renderApp('/train');
    await userEvent.click(await screen.findByRole('button', { name: /Push day/ }));
    await screen.findByRole('article', { name: 'Bench press' });
    expect(screen.getByText('Points when there’s signal')).toBeVisible();
    expect(loadLocalWorkout()?.local).toBe(true);
  });

  it('doesn’t lose a workout the server has never heard of when it answers again', async () => {
    const local = makeWorkout({ local: true, name: 'Offline push' });
    saveLocalWorkout(local);
    trainApi();
    renderApp('/train');
    await screen.findByRole('article', { name: 'Bench press' });
    expect(screen.getByRole('textbox', { name: 'Workout name' })).toHaveValue('Offline push');
  });

  it('keeps a set you check off on the phone', async () => {
    saveLocalWorkout(makeWorkout({ local: true }));
    const fetchMock = trainApi();
    renderApp('/train');
    const bench = within(await screen.findByRole('article', { name: 'Bench press' }));
    await userEvent.click(bench.getByRole('button', { name: /^Repeat .* on set 1$/ }));
    await waitFor(() => expect(loadLocalWorkout()?.exercises[0]?.sets[0]?.done).toBe(true));
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false);
  });

  it('queues the workout when finishing can’t reach the server', async () => {
    const workout = makeWorkout({
      exercises: [{ exercise_id: 'bench', sets: [DONE], previous_sets: [] }],
    });
    trainApi({
      'GET /api/workouts/active': [200, workout],
      'POST /api/workouts/w1/finish': NO_SIGNAL,
      'POST /api/workouts/w1/sync': NO_SIGNAL,
    });
    renderApp('/train');
    await userEvent.click(await screen.findByRole('button', { name: 'Finish workout' }));
    expect(await screen.findByText(/^Saved on this phone\. It gets/)).toBeVisible();
    expect(getOutbox().map((w) => w.id)).toEqual(['w1']);
    expect(await screen.findByText(/^1 workout is waiting/)).toBeVisible();
  });

  it('won’t queue a workout with nothing completed', async () => {
    trainApi({
      'GET /api/workouts/active': [200, makeWorkout()],
      'POST /api/workouts/w1/finish': NO_SIGNAL,
    });
    renderApp('/train');
    await userEvent.click(await screen.findByRole('button', { name: 'Finish workout' }));
    expect(await screen.findByText('Check off at least one set to finish.')).toBeVisible();
    expect(getOutbox()).toEqual([]);
  });

  it('finishes a phone-only workout straight away when there is signal', async () => {
    const local = makeWorkout({
      local: true,
      id: 'w7',
      exercises: [{ exercise_id: 'bench', sets: [DONE], previous_sets: [] }],
    });
    saveLocalWorkout(local);
    const fetchMock = trainApi({ 'POST /api/workouts/w7/sync': [200, FINISHED] });
    renderApp('/train');
    await userEvent.click(await screen.findByRole('button', { name: 'Finish workout' }));
    expect(await screen.findByText('Showed up')).toBeVisible();
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/workouts/w7/sync')).toBe(true);
    expect(loadLocalWorkout()).toBeNull();
  });

  it('keeps edits the server never got through a reload', async () => {
    saveDraft('w1', {
      name: 'Push day',
      gym: null,
      exercises: [{ exercise_id: 'bench', sets: [{ ...DONE, reps: 12 }], previous_sets: [] }],
    });
    const fetchMock = trainApi({
      'GET /api/workouts/active': [200, makeWorkout()],
      'PUT /api/workouts/w1': () => [200, makeWorkout()],
    });
    renderApp('/train');
    const bench = within(await screen.findByRole('article', { name: 'Bench press' }));
    expect(bench.getByLabelText('Bench press, set 1, reps')).toHaveValue(12);
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(true),
    );
    await waitFor(() => expect(loadDraft('w1')).toBeNull());
  });
});

describe('Sending what waited', () => {
  it('sends it once there is signal, and says what it paid', async () => {
    addToOutbox(QUEUED);
    const fetchMock = trainApi({
      'POST /api/workouts/w9/sync': [200, { ...FINISHED, total: 240 }],
    });
    renderApp('/me');
    expect(await screen.findByText('Push day sent: +240 points.')).toBeVisible();
    expect(getOutbox()).toEqual([]);
    const call = fetchMock.mock.calls.find(([url]) => url === '/api/workouts/w9/sync');
    const body = JSON.parse(String(call?.[1]?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({ name: 'Push day', finished_at: QUEUED.finished_at });
    expect(body).not.toHaveProperty('id');
  });

  it('stops without losing it while there is still no signal', async () => {
    addToOutbox(QUEUED);
    trainApi({ 'POST /api/workouts/w9/sync': NO_SIGNAL });
    renderApp('/me');
    expect(await screen.findByText(/^1 workout is waiting/)).toBeVisible();
    await waitFor(() => expect(getOutbox()).toHaveLength(1));
    expect(getOutbox()[0]?.failed).toBeUndefined();
  });

  it('drops one the server already has: the answer got lost last time', async () => {
    addToOutbox(QUEUED);
    trainApi({
      'POST /api/workouts/w9/sync': [409, { detail: { code: 'workout_finished' } }],
    });
    renderApp('/me');
    await waitFor(() => expect(getOutbox()).toEqual([]));
  });

  it('asks what to do with one the server refuses', async () => {
    addToOutbox(QUEUED);
    trainApi({ 'POST /api/workouts/w9/sync': [422, { detail: { code: 'unknown_exercise' } }] });
    renderApp('/me');
    expect(await screen.findByText('Push day couldn’t be saved.')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Discard it' }));
    expect(getOutbox()).toEqual([]);
  });
});

describe('What stays on the phone', () => {
  it('is what opening the app and logging a workout need', () => {
    for (const key of [
      meKey,
      catalogKey,
      activeWorkoutKey,
      weekKey,
      templatesKey,
      gymsKey,
      climbKey('all'),
    ]) {
      expect(isKeptOnPhone(key), String(key)).toBe(true);
    }
  });

  it('survives a refresh that failed for lack of signal', () => {
    const query = (status: string, data: unknown) =>
      ({ queryKey: meKey, state: { status, data } }) as unknown as Parameters<
        typeof shouldKeepQuery
      >[0];
    expect(shouldKeepQuery(query('error', makeMe()))).toBe(true);
    expect(shouldKeepQuery(query('success', makeMe()))).toBe(true);
    expect(shouldKeepQuery(query('error', undefined))).toBe(false);
  });

  it('never holds on to being signed out, or it would send you away on the way back', () => {
    const query = (queryKey: readonly unknown[], data: unknown) =>
      ({ queryKey, state: { status: 'success', data } }) as unknown as Parameters<
        typeof shouldKeepQuery
      >[0];
    expect(shouldKeepQuery(query(meKey, null))).toBe(false);
    // No workout in progress is real information, though.
    expect(shouldKeepQuery(query(activeWorkoutKey, null))).toBe(true);
  });

  it('isn’t what other people wrote or anything heavy', () => {
    for (const key of [feedKey, inboxKey, ['me', 'stats'], ['me', 'workouts', 'w1']]) {
      expect(isKeptOnPhone(key), String(key)).toBe(false);
    }
  });
});

describe('Signing out', () => {
  it('leaves nothing of the account behind but the fact you’re signed out', async () => {
    trainApi({
      'GET /api/me/gyms': [200, [{ id: 'g1', name: 'Smart Fit', is_default: true }]],
      'POST /api/auth/logout': [204, null],
    });
    const { client } = renderApp('/train');
    await screen.findByRole('button', { name: /Push day/ });
    await waitFor(() => expect(client.getQueryData(gymsKey)).toBeDefined());
    addToOutbox(QUEUED);
    await userEvent.click(screen.getByRole('button', { name: /^Your profile/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Log out' }));
    await waitFor(() => expect(client.getQueryData(meKey)).toBeNull());
    expect(client.getQueryData(gymsKey)).toBeUndefined();
    expect(client.getQueryData(catalogKey)).toBeUndefined();
    expect(getOutbox()).toEqual([]);
  });
});

describe('Low signal mode', () => {
  afterEach(() => chooseLowData(false));

  it('refreshes live data less often when chosen', () => {
    expect(liveInterval()).toBe(20_000);
    chooseLowData(true);
    expect(liveInterval()).toBe(120_000);
  });

  it('doesn’t refresh at all with no connection', () => {
    const spy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    expect(liveInterval()).toBe(false);
    spy.mockRestore();
  });
});
