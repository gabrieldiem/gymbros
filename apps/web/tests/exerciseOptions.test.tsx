import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { Catalog, Exercise, SetData } from '../src/api/train';
import { createQueryClient } from '../src/api/queryClient';
import { formatPostedSet } from '../src/features/crew/format';
import { ExerciseCard } from '../src/features/train/ExerciseCard';
import { ExercisePicker } from '../src/features/train/ExercisePicker';
import { hasNoWeight, withoutWeight } from '../src/features/train/barbell';
import type { DraftExercise } from '../src/features/train/useWorkoutDraft';
import { Providers } from '../src/Providers';
import { makeMe, mockApi, renderApp } from './renderApp';
import { CATALOG, makeWorkout, set } from './trainFixtures';

const SQUAT: Exercise = {
  id: 'squat',
  name: 'Back squat',
  group: 'Legs',
  type: 'w',
  barbell: true,
  ppl: 'legs',
  aliases_es: ['sentadilla'],
};
const THAI: Exercise = {
  id: 'muaythai',
  name: 'Muay Thai',
  group: 'Cardio',
  type: 'c',
  barbell: false,
  ppl: null,
  aliases_es: ['muai tai'],
  minute_effort_km: 0.13,
};
const CUSTOM: Exercise = {
  ...SQUAT,
  id: 'custom',
  name: 'Custom exercise',
  type: 'x',
  barbell: false,
};

function Card({ exercise, entry }: { exercise: Exercise; entry: DraftExercise }) {
  const [sets, setSets] = useState(entry.sets);
  return (
    <>
      <ExerciseCard
        exercise={exercise}
        entry={{ ...entry, sets }}
        onChange={setSets}
        onRemove={vi.fn()}
        onPlates={vi.fn()}
      />
      <output data-testid="sets">{JSON.stringify(sets)}</output>
    </>
  );
}

function renderCard(exercise: Exercise, sets: SetData[], customName?: string) {
  mockApi({ 'GET /api/me': [200, makeMe()], 'GET /api/me/stats': [200, { prs: [] }] });
  render(
    <Providers client={createQueryClient()}>
      <Card
        exercise={exercise}
        entry={{
          exercise_id: exercise.id,
          sets,
          previous_sets: [],
          ...(customName ? { custom_name: customName } : {}),
        }}
      />
    </Providers>,
  );
}

const shown = () => JSON.parse(screen.getByTestId('sets').textContent ?? '[]') as SetData[];

describe('A set with no weight', () => {
  it('turns every set to no weight and back, with no bar', () => {
    const sets = [set(60, 5, true), set(60, 5, true)];
    const off = withoutWeight(SQUAT, sets, true);
    expect(hasNoWeight(off)).toBe(true);
    expect(off[0]).toMatchObject({ load_kg: 0, bar_kg: null, reps: 5, done: true });
    expect(withoutWeight(SQUAT, off, false)[0]).toMatchObject({ load_kg: null });
  });

  it('is a button on the card that hides what only a bar needs', async () => {
    renderCard(SQUAT, [set(null, null, false)]);
    expect(await screen.findByRole('button', { name: 'Plates' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'No weight' }));
    expect(screen.getByRole('button', { name: 'No weight' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.queryByRole('button', { name: 'Plates' })).toBeNull();
    expect(screen.getByLabelText('Back squat, set 1, disks')).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Back squat, set 1, reps'), '20');
    expect(shown()[0]).toMatchObject({ load_kg: 0, reps: 20, done: true });
  });

  it('is shown as body weight on a post', () => {
    const post = { load_kg: 0, reps: 20, minutes: null, km: null };
    expect(formatPostedSet(SQUAT, post, String, () => '')).toBe('BW×20');
  });
});

describe('A timed sport', () => {
  it('asks for minutes only', async () => {
    renderCard(THAI, [{ load_kg: null, reps: null, minutes: null, km: null, done: false }]);
    expect(await screen.findByLabelText('Muay Thai, set 1, min')).toBeVisible();
    expect(screen.queryByLabelText('Muay Thai, set 1, km')).toBeNull();
  });

  it('shows no distance on a post', () => {
    const post = { load_kg: null, reps: null, minutes: 60, km: null };
    expect(formatPostedSet(THAI, post, String, () => '')).toBe('60 min');
  });
});

describe('A custom exercise', () => {
  it('shows its own name and that it pays nothing', async () => {
    renderCard(CUSTOM, [set(null, null, false)], 'Sled push');
    const card = await screen.findByRole('article', { name: 'Sled push' });
    expect(within(card).getByText('No points')).toBeVisible();
    expect(within(card).getByLabelText('Sled push, set 1, reps')).toBeVisible();
  });

  const openPicker = () => {
    const onPick = vi.fn();
    const onPickCustom = vi.fn();
    mockApi({ 'GET /api/me': [200, makeMe()] });
    render(
      <Providers client={createQueryClient()}>
        <ExercisePicker
          exercises={[SQUAT, THAI, CUSTOM]}
          onPick={onPick}
          onPickCustom={onPickCustom}
          onClose={vi.fn()}
        />
      </Providers>,
    );
    return { onPick, onPickCustom };
  };

  it('isn’t listed with the real ones', async () => {
    openPicker();
    expect(await screen.findByRole('button', { name: 'Back squat' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Custom exercise' })).toBeNull();
  });

  it('can be added by name, saying it pays nothing', async () => {
    const { onPickCustom } = openPicker();
    expect(await screen.findByText(/pay no points/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Add it' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/^Not on the list/), 'Sled push');
    await userEvent.click(screen.getByRole('button', { name: 'Add it' }));
    expect(onPickCustom).toHaveBeenCalledWith('Sled push');
  });

  it('offers what you searched for when nothing matched', async () => {
    const { onPickCustom } = openPicker();
    await userEvent.type(screen.getByRole('searchbox'), 'Tyre flip');
    expect(screen.getByLabelText(/^Not on the list/)).toHaveValue('Tyre flip');
    await userEvent.click(screen.getByRole('button', { name: 'Add it' }));
    expect(onPickCustom).toHaveBeenCalledWith('Tyre flip');
  });
});

describe('The workout banner', () => {
  const open = (routes = {}) => {
    const fetchMock = mockApi({
      'GET /api/me': [200, makeMe()],
      'GET /api/workouts/active': [200, makeWorkout({ id: 'w1' })],
      'DELETE /api/workouts/w1': [204, null],
      ...routes,
    });
    renderApp('/me');
    return fetchMock;
  };

  it('still goes back to the workout', async () => {
    open();
    const back = await screen.findByRole('link', { name: /Back to your workout/ });
    expect(back).toHaveAttribute('href', '/train');
  });

  it('cancels the workout, only after asking', async () => {
    const fetchMock = open();
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel workout' }));
    const sheet = within(await screen.findByRole('dialog'));
    const deletes = () => fetchMock.mock.calls.filter(([, init]) => init?.method === 'DELETE');
    expect(deletes()).toHaveLength(0);
    await userEvent.click(sheet.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(deletes()).toHaveLength(0);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel workout' }));
    const again = within(await screen.findByRole('dialog'));
    await userEvent.click(again.getByRole('button', { name: /^(Discard|Yes)/ }));
    await waitFor(() => expect(deletes()).toHaveLength(1));
  });
});

// Keeps the fixture honest about what the type now allows.
export const _catalog: Catalog = CATALOG;
