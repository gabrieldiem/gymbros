import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { makeMe, mockApi, renderApp } from './renderApp';
import { CATALOG, FINISHED, makeWorkout } from './trainFixtures';

const WEEK = { workouts: 1, target: 3, leg_event_active: true };

function trainApi(routes: Parameters<typeof mockApi>[0] = {}) {
  return mockApi({
    'GET /api/me': [200, makeMe()],
    'GET /api/catalog': [200, CATALOG],
    'GET /api/workouts/week': [200, WEEK],
    'GET /api/workouts/active': [200, null],
    ...routes,
  });
}

function bodyOf(fetchMock: ReturnType<typeof mockApi>, method: string, url: string) {
  const call = [...fetchMock.mock.calls]
    .reverse()
    .find(([u, init]) => u === url && init?.method === method);
  return call ? (JSON.parse(String(call[1]?.body)) as unknown) : undefined;
}

describe('Train: start screen', () => {
  it('shows routines, the week pips and how points are earned', async () => {
    trainApi();
    renderApp('/train');
    expect(await screen.findByRole('heading', { level: 1, name: 'Start a workout' })).toBeVisible();
    expect(screen.getByText('1 of 3 workouts this week. Two more to hit your goal.')).toBeVisible();
    expect(screen.getByRole('img', { name: '1 of 3 workouts this week' })).toBeVisible();
    const legDay = screen.getByRole('button', { name: /Leg day/ });
    expect(within(legDay).getByText('Leg day x2 bonus this week')).toBeVisible();
    expect(screen.getByRole('button', { name: /Push day/ })).toHaveTextContent(
      'Bench press, Overhead press',
    );
    expect(screen.getByText('Hit 3 workouts in a week').nextSibling).toHaveTextContent('150');
  });

  it('starts a routine and opens the logger with last time and the overload hint', async () => {
    const fetchMock = trainApi({ 'POST /api/workouts': [201, makeWorkout()] });
    renderApp('/train');
    await userEvent.click(await screen.findByRole('button', { name: /Push day/ }));
    const bench = await screen.findByRole('article', { name: 'Bench press' });
    expect(within(bench).getByText('↑ Loaded to beat last time')).toBeVisible();
    expect(within(bench).getAllByText('90 × 5')).toHaveLength(2);
    expect(within(bench).getByLabelText('Bench press, set 1, kg')).toHaveValue(92.5);
    expect(bodyOf(fetchMock, 'POST', '/api/workouts')).toEqual({ routine_id: 'push' });
  });
});

describe('Train: logging', () => {
  it('saves a checked set and shows the server’s live points', async () => {
    const fetchMock = trainApi({
      'GET /api/workouts/active': [200, makeWorkout()],
      'PUT /api/workouts/w1': () => [200, makeWorkout({ live_points: 58 })],
    });
    renderApp('/train');
    const bench = await screen.findByRole('article', { name: 'Bench press' });
    await userEvent.click(within(bench).getByRole('button', { name: 'Complete set 1' }));
    expect(within(bench).getByRole('button', { name: 'Complete set 1' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await waitFor(() => expect(screen.getByTestId('live-points')).toHaveTextContent('58'), {
      timeout: 2000,
    });
    const body = bodyOf(fetchMock, 'PUT', '/api/workouts/w1') as {
      exercises: { sets: { done: boolean }[] }[];
    };
    expect(body.exercises[0]?.sets[0]?.done).toBe(true);
    expect(screen.getByRole('timer', { name: 'Rest' })).toBeVisible();
  });

  it('finds exercises by Spanish alias and adds them', async () => {
    trainApi({ 'GET /api/workouts/active': [200, makeWorkout({ exercises: [] })] });
    renderApp('/train');
    await userEvent.click(await screen.findByRole('button', { name: '+ Add exercise' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add exercise' });
    await userEvent.type(within(dialog).getByRole('searchbox'), 'sentadilla');
    expect(within(dialog).queryByRole('button', { name: 'Bench press' })).toBeNull();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Back squat' }));
    expect(await screen.findByRole('article', { name: 'Back squat' })).toBeVisible();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens the plate calculator for a barbell lift', async () => {
    trainApi({ 'GET /api/workouts/active': [200, makeWorkout()] });
    renderApp('/train');
    const bench = await screen.findByRole('article', { name: 'Bench press' });
    await userEvent.click(within(bench).getByRole('button', { name: 'Plates' }));
    const dialog = await screen.findByRole('dialog', { name: 'Plate calculator' });
    expect(within(dialog).getByRole('status')).toHaveTextContent(
      'Each side: 1 × 25 kg, 1 × 10 kg, 1 × 1.25 kg',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('discards after confirming', async () => {
    const fetchMock = trainApi({
      'GET /api/workouts/active': [200, makeWorkout()],
      'DELETE /api/workouts/w1': [204, null],
    });
    renderApp('/train');
    await userEvent.click(await screen.findByRole('button', { name: 'Discard' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Discard this workout? Your sets will not be saved.',
    });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Discard workout' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Start a workout' })).toBeVisible();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/workouts/w1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});

describe('Train: finishing', () => {
  it('shows every line item from the API and the total', async () => {
    trainApi({
      'GET /api/workouts/active': [200, makeWorkout()],
      'PUT /api/workouts/w1': () => [200, makeWorkout()],
      'POST /api/workouts/w1/finish': [200, FINISHED],
    });
    renderApp('/train');
    await userEvent.click(await screen.findByRole('button', { name: 'Finish workout' }));
    const dialog = await screen.findByRole('dialog', { name: 'Push day' });
    expect(within(dialog).getByText('Push day done in 52 min')).toBeVisible();
    expect(within(dialog).getByText('Showed up')).toBeVisible();
    expect(within(dialog).getByText('2 completed sets')).toBeVisible();
    expect(within(dialog).getByText('New PR: Bench press 92.5 kg × 5')).toBeVisible();
    expect(within(dialog).getByText('Better than last time (+3%)')).toBeVisible();
    expect(
      within(dialog).getByText('+3% volume vs last time. Better than yesterday.'),
    ).toBeVisible();
    expect(within(dialog).getByText('+100')).toBeVisible();
    expect(within(dialog).getByText(/213/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'See ATUS Climb' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'ATUS Climb' })).toBeVisible();
  });

  it('explains why an empty workout cannot be finished', async () => {
    trainApi({
      'GET /api/workouts/active': [200, makeWorkout()],
      'POST /api/workouts/w1/finish': [409, { detail: { code: 'workout_empty' } }],
    });
    renderApp('/train');
    await userEvent.click(await screen.findByRole('button', { name: 'Finish workout' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Check off at least one set to finish.',
    );
  });
});

describe('Active workout bar', () => {
  it('links back to the workout from other tabs', async () => {
    trainApi({ 'GET /api/workouts/active': [200, makeWorkout({ live_points: 120 })] });
    renderApp('/crew');
    const bar = await screen.findByRole('link', { name: /Back to your workout/ });
    expect(bar).toHaveAttribute('href', '/train');
    expect(bar).toHaveTextContent('120 pts so far');
    expect(screen.getByRole('img', { name: 'Training now' })).toBeInTheDocument();
  });
});
