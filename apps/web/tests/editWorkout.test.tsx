import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { createQueryClient } from '../src/api/queryClient';
import { WorkoutDetailSheet } from '../src/features/me/WorkoutDetailSheet';
import { Providers } from '../src/Providers';
import { makeMe, mockApi } from './renderApp';
import { CATALOG } from './trainFixtures';

const SOON = new Date(Date.now() + 60 * 60 * 1000).toISOString();
const GONE = new Date(Date.now() - 60 * 1000).toISOString();

const DETAIL = {
  id: 'w1',
  name: 'Push day',
  gym: 'Home',
  photo_url: null,
  performed_on: null,
  finished_at: '2026-11-02T12:00:00Z',
  duration_min: 40,
  points: 100,
  sets: 1,
  volume_kg: 300,
  exercises: [
    {
      exercise_id: 'bench',
      sets: [{ load_kg: 60, bar_kg: 20, reps: 5, minutes: null, km: null, done: true }],
    },
  ],
  line_items: [{ key: 'ln_show', vars: {}, points: 100 }],
  editable_until: SOON,
};

function open(detail: object, routes: Parameters<typeof mockApi>[0] = {}) {
  const fetchMock = mockApi({
    'GET /api/me': [200, makeMe()],
    'GET /api/me/gyms': [200, [{ id: 'g1', name: 'Home', is_default: true }]],
    'GET /api/catalog': [200, CATALOG],
    'GET /api/me/workouts/w1': [200, detail],
    ...routes,
  });
  render(
    <Providers client={createQueryClient()}>
      <WorkoutDetailSheet workoutId="w1" title="Push day" onClose={vi.fn()} />
    </Providers>,
  );
  return fetchMock;
}

async function openEditor() {
  await userEvent.click(await screen.findByRole('button', { name: 'Edit workout' }));
  return within(await screen.findByRole('dialog', { name: 'Edit workout' }));
}

describe('Editing a finished workout', () => {
  it('is offered with its deadline while there is time', async () => {
    open(DETAIL);
    expect(await screen.findByRole('button', { name: 'Edit workout' })).toBeVisible();
    expect(screen.getByText(/^You can edit it until/)).toBeVisible();
  });

  it('is not offered once the time is up', async () => {
    open({ ...DETAIL, editable_until: null });
    await screen.findByText('Push day');
    await screen.findByText(/^Total/);
    expect(screen.queryByRole('button', { name: 'Edit workout' })).toBeNull();
  });

  it('is not offered if the time ran out while the answer was kept', async () => {
    open({ ...DETAIL, editable_until: GONE });
    await screen.findByText(/^Total/);
    expect(screen.queryByRole('button', { name: 'Edit workout' })).toBeNull();
  });

  it('starts from what you logged, and saves nothing until asked', async () => {
    const fetchMock = open(DETAIL);
    const sheet = await openEditor();
    expect(sheet.getByLabelText('Workout name')).toHaveValue('Push day');
    await userEvent.clear(sheet.getByLabelText('Workout name'));
    await userEvent.type(sheet.getByLabelText('Workout name'), 'Evening');
    const edits = () =>
      fetchMock.mock.calls.filter(([url]) => String(url) === '/api/workouts/w1/edit');
    expect(edits()).toHaveLength(0);
    await userEvent.click(sheet.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Edit workout' })).toBeNull());
    expect(edits()).toHaveLength(0);
  });

  it('sends the whole workout, and shows the new points', async () => {
    const fetchMock = open(DETAIL, {
      'PUT /api/workouts/w1/edit': [
        200,
        {
          ...DETAIL,
          name: 'Evening',
          points: 140,
          line_items: [{ key: 'ln_show', vars: {}, points: 140 }],
        },
      ],
    });
    const sheet = await openEditor();
    await userEvent.clear(sheet.getByLabelText('Workout name'));
    await userEvent.type(sheet.getByLabelText('Workout name'), 'Evening');
    await userEvent.click(sheet.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Edit workout' })).toBeNull());
    const call = fetchMock.mock.calls.find(([url]) => String(url) === '/api/workouts/w1/edit');
    const body = JSON.parse(String(call?.[1]?.body)) as {
      name: string;
      gym: string;
      exercises: {
        exercise_id: string;
        sets: { load_kg: number; done: boolean; started?: boolean }[];
      }[];
    };
    expect(body.name).toBe('Evening');
    expect(body.gym).toBe('Home');
    expect(body.exercises[0]?.exercise_id).toBe('bench');
    expect(body.exercises[0]?.sets[0]?.load_kg).toBe(60);
    expect(body.exercises[0]?.sets[0]?.done).toBe(true);
    expect(body.exercises[0]?.sets[0]).not.toHaveProperty('started');
    expect(await screen.findAllByText('+140')).not.toHaveLength(0);
  });

  it('says so when the time ran out in the meantime, and keeps what you typed', async () => {
    open(DETAIL, {
      'PUT /api/workouts/w1/edit': [409, { detail: { code: 'workout_edit_expired' } }],
    });
    const sheet = await openEditor();
    await userEvent.click(sheet.getByRole('button', { name: 'Save changes' }));
    expect(await sheet.findByText('The time to edit this workout has passed.')).toBeVisible();
    expect(screen.getByRole('dialog', { name: 'Edit workout' })).toBeVisible();
  });

  it('says so when it would be left empty', async () => {
    open(DETAIL, { 'PUT /api/workouts/w1/edit': [409, { detail: { code: 'workout_empty' } }] });
    const sheet = await openEditor();
    await userEvent.click(sheet.getByRole('button', { name: 'Save changes' }));
    expect(await sheet.findByRole('alert')).toBeVisible();
  });
});
