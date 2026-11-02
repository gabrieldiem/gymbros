import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { clearOfflineData } from '../src/features/train/offlineStore';
import { makeMe, mockApi, renderApp } from './renderApp';
import { CATALOG, FINISHED, makeWorkout } from './trainFixtures';

const WEEK = {
  workouts: 1,
  target: 3,
  leg_event_active: true,
  past_days: [
    { day: '2026-11-01', workouts: 0 },
    { day: '2026-10-31', workouts: 1 },
    { day: '2026-10-30', workouts: 0 },
  ],
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

function bodyOf(fetchMock: ReturnType<typeof mockApi>, method: string, url: string) {
  const call = [...fetchMock.mock.calls]
    .reverse()
    .find(([u, init]) => u === url && init?.method === method);
  return call ? (JSON.parse(String(call[1]?.body)) as unknown) : undefined;
}

afterEach(() => clearOfflineData());

describe('Train: entering sets', () => {
  const lastPut = (fetchMock: ReturnType<typeof mockApi>) =>
    bodyOf(fetchMock, 'PUT', '/api/workouts/w1') as {
      exercises: { sets: Record<string, unknown>[] }[];
    };
  const twoEmptySets = makeWorkout({
    exercises: [
      {
        exercise_id: 'bench',
        sets: [
          { load_kg: 60, bar_kg: 20, reps: 8, minutes: null, km: null, done: true },
          { load_kg: null, reps: null, minutes: null, km: null, done: false },
        ],
        previous_sets: [],
      },
    ],
  });
  const openBench = async (routes = {}) => {
    const fetchMock = trainApi({
      'GET /api/workouts/active': [200, twoEmptySets],
      'PUT /api/workouts/w1': () => [200, twoEmptySets],
      ...routes,
    });
    renderApp('/train');
    return {
      fetchMock,
      bench: within(await screen.findByRole('article', { name: 'Bench press' })),
    };
  };

  it('logs a set with one tap on repeat', async () => {
    const { fetchMock, bench } = await openBench();
    await userEvent.click(bench.getByRole('button', { name: 'Repeat 40 × 8 on set 2' }));
    expect(bench.getByLabelText('Bench press, set 2, disks')).toHaveValue(40);
    expect(bench.getByLabelText('Bench press, set 2, reps')).toHaveValue(8);
    await waitFor(() =>
      expect(lastPut(fetchMock).exercises[0]?.sets[1]).toMatchObject({
        load_kg: 60,
        bar_kg: 20,
        reps: 8,
        done: true,
      }),
    );
  });

  it('has nothing to repeat on the first set of a new exercise', async () => {
    const { bench } = await openBench();
    const first = bench.getByLabelText('Bench press, set 1, disks').parentElement as HTMLElement;
    expect(within(first).getAllByRole('button')[0]).toBeDisabled();
  });

  it('sends the whole weight when you type the disks', async () => {
    const { fetchMock, bench } = await openBench();
    await userEvent.type(bench.getByLabelText('Bench press, set 2, disks'), '50');
    await waitFor(() =>
      expect(lastPut(fetchMock).exercises[0]?.sets[1]).toMatchObject({ load_kg: 70, bar_kg: 20 }),
    );
  });

  it('keeps the disks and changes the whole weight with another bar', async () => {
    const { fetchMock, bench } = await openBench();
    await userEvent.selectOptions(bench.getByLabelText('Bar'), '15');
    expect(bench.getByLabelText('Bench press, set 1, disks')).toHaveValue(40);
    await waitFor(() =>
      expect(lastPut(fetchMock).exercises[0]?.sets[0]).toMatchObject({ load_kg: 55, bar_kg: 15 }),
    );
  });

  it('counts reps with no disks as the empty bar', async () => {
    const { fetchMock, bench } = await openBench();
    await userEvent.type(bench.getByLabelText('Bench press, set 2, reps'), '10');
    await waitFor(() =>
      expect(lastPut(fetchMock).exercises[0]?.sets[1]).toMatchObject({
        load_kg: 20,
        reps: 10,
        done: true,
      }),
    );
  });

  it('counts nothing until a loaded set is logged', async () => {
    const loaded = makeWorkout();
    const fetchMock = trainApi({
      'GET /api/workouts/active': [200, loaded],
      'PUT /api/workouts/w1': () => [200, loaded],
    });
    renderApp('/train');
    const bench = within(await screen.findByRole('article', { name: 'Bench press' }));
    await userEvent.type(bench.getByLabelText('Bench press, set 2, reps'), '6');
    await waitFor(() => {
      const sets = lastPut(fetchMock).exercises[0]?.sets ?? [];
      expect(sets[0]).toMatchObject({ done: false });
      // The set you typed in takes its suggested disks along with it.
      expect(sets[1]).toMatchObject({ done: true, reps: 6, load_kg: 92.5 });
    });
    expect(bench.getByLabelText('Bench press, set 2, disks')).toHaveValue(72.5);
  });

  it('shows what you typed in an empty row before it counts', async () => {
    const { fetchMock, bench } = await openBench();
    await userEvent.type(bench.getByLabelText('Bench press, set 2, disks'), '50');
    expect(bench.getByLabelText('Bench press, set 2, disks')).toHaveValue(50);
    await waitFor(() =>
      expect(lastPut(fetchMock).exercises[0]?.sets[1]).toMatchObject({ load_kg: 70, done: false }),
    );
  });

  it('adds a set as a suggestion of the one above', async () => {
    const { bench } = await openBench();
    await userEvent.click(bench.getByRole('button', { name: /Add set/ }));
    const added = bench.getByLabelText('Bench press, set 3, disks');
    expect(added).toHaveValue(null);
  });

  it('removes a row, but not the only one', async () => {
    const { bench } = await openBench();
    await userEvent.click(bench.getByRole('button', { name: 'Remove set 2' }));
    expect(bench.queryByLabelText('Bench press, set 2, disks')).toBeNull();
    expect(bench.queryByRole('button', { name: 'Remove set 1' })).toBeNull();
  });
});

describe('Train: a photo of the workout', () => {
  it('offers to add one, and shows it with a way to remove it once there', async () => {
    trainApi({
      'GET /api/workouts/active': [200, makeWorkout({ photo_url: '/api/workouts/w1/photo?v=1' })],
      'DELETE /api/workouts/w1/photo': [200, { photo_url: null }],
    });
    renderApp('/train');
    expect(await screen.findByRole('img', { name: 'Your gym photo' })).toHaveAttribute(
      'src',
      '/api/workouts/w1/photo?v=1',
    );
    expect(screen.getByRole('button', { name: 'Change photo' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Remove photo' })).toBeVisible();
  });

  it('has only the add button without one', async () => {
    trainApi({ 'GET /api/workouts/active': [200, makeWorkout()] });
    renderApp('/train');
    expect(await screen.findByRole('button', { name: 'Add a gym photo' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Remove photo' })).toBeNull();
  });
});

describe('Train: gyms', () => {
  const GYMS = [
    { id: 'g1', name: 'Smart Fit', is_default: true },
    { id: 'g2', name: 'Home', is_default: false },
  ];

  it('starts at your default gym unless you pick another', async () => {
    const fetchMock = trainApi({
      'GET /api/me/gyms': [200, GYMS],
      'POST /api/workouts': [201, makeWorkout({ gym: 'Home' })],
    });
    renderApp('/train');
    const select = await screen.findByRole('combobox', { name: 'At' });
    await waitFor(() => expect(select).toHaveValue('Smart Fit'));
    await userEvent.selectOptions(select, 'Home');
    await userEvent.click(screen.getByRole('button', { name: /Push day/ }));
    await screen.findByRole('article', { name: 'Bench press' });
    expect(bodyOf(fetchMock, 'POST', '/api/workouts')).toEqual({
      routine_id: 'push',
      gym: 'Home',
    });
  });

  it('leaves the default to the server when you don’t choose', async () => {
    const fetchMock = trainApi({
      'GET /api/me/gyms': [200, GYMS],
      'POST /api/workouts': [201, makeWorkout({ gym: 'Smart Fit' })],
    });
    renderApp('/train');
    await screen.findByRole('combobox', { name: 'At' });
    await userEvent.click(screen.getByRole('button', { name: /Push day/ }));
    await screen.findByRole('article', { name: 'Bench press' });
    expect(bodyOf(fetchMock, 'POST', '/api/workouts')).toEqual({ routine_id: 'push' });
  });

  it('hides the picker when you have no gyms', async () => {
    trainApi({ 'GET /api/me/gyms': [200, []] });
    renderApp('/train');
    await screen.findByRole('button', { name: /Push day/ });
    expect(screen.queryByRole('combobox', { name: 'At' })).toBeNull();
  });

  it('changes the gym while logging and keeps a gym you’ve since deleted', async () => {
    const workout = makeWorkout({ gym: 'Old place' });
    const fetchMock = trainApi({
      'GET /api/me/gyms': [200, GYMS],
      'GET /api/workouts/active': [200, workout],
      'PUT /api/workouts/w1': () => [200, workout],
    });
    renderApp('/train');
    const select = await screen.findByRole('combobox', { name: 'At' });
    expect(select).toHaveValue('Old place');
    await waitFor(() => expect(within(select).getByRole('option', { name: 'Home' })).toBeTruthy());
    await userEvent.selectOptions(select, 'No gym');
    await waitFor(() =>
      expect(bodyOf(fetchMock, 'PUT', '/api/workouts/w1')).toMatchObject({ gym: null }),
    );
  });
});

describe('Train: the timed event', () => {
  it('marks every leg exercise, in any workout, and not the others', async () => {
    trainApi({
      'GET /api/workouts/active': [
        200,
        makeWorkout({
          routine_id: null,
          exercises: [
            { exercise_id: 'squat', sets: [], previous_sets: [] },
            { exercise_id: 'bench', sets: [], previous_sets: [] },
          ],
        }),
      ],
    });
    renderApp('/train');
    const squat = within(await screen.findByRole('article', { name: 'Back squat' }));
    expect(squat.getByText('x2')).toBeVisible();
    const bench = within(screen.getByRole('article', { name: 'Bench press' }));
    expect(bench.queryByText('x2')).toBeNull();
  });
});

describe('Train: stretching', () => {
  const stretching = makeWorkout({
    name: 'Stretching',
    routine_id: 'stretch',
    exercises: [
      {
        exercise_id: 'stretch',
        sets: [{ load_kg: null, reps: null, minutes: 5, km: null, done: false }],
        previous_sets: [],
      },
    ],
  });

  it('asks only how long and whether you did it, without a rest timer', async () => {
    const fetchMock = trainApi({
      'GET /api/workouts/active': [200, stretching],
      'PUT /api/workouts/w1': () => [200, stretching],
    });
    renderApp('/train');
    const card = within(await screen.findByRole('article', { name: 'Stretching' }));
    expect(card.getByRole('button', { name: '5 min' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText(/Doesn’t count towards your weekly goal/)).toBeVisible();
    await userEvent.click(card.getByRole('button', { name: '10 min' }));
    expect(card.getByRole('button', { name: '10 min' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('timer', { name: 'Rest' })).toBeNull();
    await waitFor(() =>
      expect(bodyOf(fetchMock, 'PUT', '/api/workouts/w1')).toMatchObject({
        exercises: [{ exercise_id: 'stretch', sets: [{ minutes: 10, done: true }] }],
      }),
    );
  });

  it('starts at five minutes when added to a workout', async () => {
    const fetchMock = trainApi({
      'GET /api/workouts/active': [200, makeWorkout()],
      'PUT /api/workouts/w1': () => [200, makeWorkout()],
    });
    renderApp('/train');
    await userEvent.click(await screen.findByRole('button', { name: /Add exercise/ }));
    await userEvent.click(await screen.findByRole('button', { name: /Stretching/ }));
    const card = within(await screen.findByRole('article', { name: 'Stretching' }));
    expect(card.getByRole('button', { name: '5 min' })).toHaveAttribute('aria-pressed', 'false');
    await waitFor(() =>
      expect(bodyOf(fetchMock, 'PUT', '/api/workouts/w1')).toMatchObject({
        exercises: [{}, { exercise_id: 'stretch', sets: [{ minutes: 5, done: false }] }],
      }),
    );
  });
});

describe('Train: your PR in the logger', () => {
  it('shows your current PR next to the exercise', async () => {
    trainApi({
      'GET /api/workouts/active': [200, makeWorkout()],
      'GET /api/me/stats': [
        200,
        {
          prs: [
            {
              exercise_id: 'bench',
              load_kg: 92.5,
              reps: 5,
              e1rm: 108,
              achieved_at: '2026-10-30T18:00:00Z',
            },
          ],
        },
      ],
    });
    renderApp('/train');
    const bench = await screen.findByRole('article', { name: 'Bench press' });
    expect(await within(bench).findByText('PR 72.5 kg + bar × 5')).toBeVisible();
  });

  it('shows nothing for an exercise you have no PR on', async () => {
    trainApi({ 'GET /api/workouts/active': [200, makeWorkout()] });
    renderApp('/train');
    const bench = await screen.findByRole('article', { name: 'Bench press' });
    expect(within(bench).queryByText(/^PR /)).toBeNull();
  });
});

describe('Train: logging a past workout', () => {
  const openPicker = async () => {
    await userEvent.click(await screen.findByRole('button', { name: /Log a past workout/ }));
    return within(await screen.findByRole('dialog', { name: 'Which day was it?' }));
  };

  it('lists the days the server allows and what is already logged', async () => {
    trainApi();
    renderApp('/train');
    const sheet = await openPicker();
    expect(sheet.getByRole('button', { name: /^Yesterday, Sun,? 1 Nov/ })).toBeVisible();
    expect(sheet.getByRole('button', { name: /Sat,? 31 Oct/ })).toHaveTextContent(
      'Already logged: 1',
    );
    expect(sheet.getAllByRole('button', { name: /Oct|Nov/ })).toHaveLength(3);
  });

  it('starts the routine you pick for that day', async () => {
    const past = makeWorkout({ performed_on: '2026-10-30' });
    const fetchMock = trainApi({ 'POST /api/workouts': [201, past] });
    renderApp('/train');
    const sheet = await openPicker();
    await userEvent.click(sheet.getByRole('button', { name: /Fri,? 30 Oct/ }));
    expect(await screen.findByText(/^Logging a workout for Fri,? 30 Oct\.$/)).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: /Push day/ }));
    await screen.findByRole('article', { name: 'Bench press' });
    expect(bodyOf(fetchMock, 'POST', '/api/workouts')).toEqual({
      routine_id: 'push',
      performed_on: '2026-10-30',
    });
  });

  it('can go back to logging today', async () => {
    const fetchMock = trainApi({ 'POST /api/workouts': [201, makeWorkout()] });
    renderApp('/train');
    const sheet = await openPicker();
    await userEvent.click(sheet.getByRole('button', { name: /Fri,? 30 Oct/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Log today instead' }));
    await userEvent.click(screen.getByRole('button', { name: /Push day/ }));
    await screen.findByRole('article', { name: 'Bench press' });
    expect(bodyOf(fetchMock, 'POST', '/api/workouts')).toEqual({ routine_id: 'push' });
  });

  it('logs without a clock, a rest timer or the overload hint', async () => {
    trainApi({
      'GET /api/workouts/active': [200, makeWorkout({ performed_on: '2026-10-30' })],
      'PUT /api/workouts/w1': () => [200, makeWorkout({ performed_on: '2026-10-30' })],
    });
    renderApp('/train');
    const bench = await screen.findByRole('article', { name: 'Bench press' });
    expect(screen.getByText(/^For Fri,? 30 Oct$/)).toBeVisible();
    expect(screen.queryByRole('timer')).toBeNull();
    expect(within(bench).queryByText('Loaded to beat last time')).toBeNull();
    await userEvent.click(within(bench).getByRole('button', { name: /^Repeat .* on set 1$/ }));
    expect(screen.queryByRole('timer', { name: 'Rest' })).toBeNull();
  });

  it('says which day it was for on the finish screen', async () => {
    trainApi({
      'GET /api/workouts/active': [200, makeWorkout({ performed_on: '2026-10-30' })],
      'POST /api/workouts/w1/finish': [200, { ...FINISHED, performed_on: '2026-10-30' }],
    });
    renderApp('/train');
    await userEvent.click(await screen.findByRole('button', { name: 'Finish workout' }));
    expect(await screen.findByText(/^Push day logged for Fri,? 30 Oct$/)).toBeVisible();
  });
});

describe('Train: start screen', () => {
  it('shows routines, the week pips and how points are earned', async () => {
    trainApi();
    renderApp('/train');
    expect(await screen.findByRole('heading', { level: 1, name: 'Start a workout' })).toBeVisible();
    expect(screen.getByText('1 of 3 workouts this week. Two more to hit your goal.')).toBeVisible();
    expect(screen.getByRole('img', { name: '1 of 3 workouts this week' })).toBeVisible();
    const legDay = screen.getByRole('button', { name: /Leg day/ });
    expect(within(legDay).getByText('Leg sets pay double')).toBeVisible();
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
    expect(within(bench).getByText('Loaded to beat last time')).toBeVisible();
    // Last time's set on the first row, the row above on the next one. The disks, not the bar.
    expect(within(bench).getByRole('button', { name: 'Repeat 72.5 × 5 on set 1' })).toBeVisible();
    expect(within(bench).getByRole('button', { name: 'Repeat 72.5 × 5 on set 2' })).toBeVisible();
    // Loaded numbers are suggestions until you log them.
    const disks = within(bench).getByLabelText('Bench press, set 1, disks');
    expect(disks).toHaveValue(null);
    expect(disks).toHaveAttribute('placeholder', '72.5');
    expect(within(bench).getByText('= 92.5 kg with the bar, 36.25 kg per side')).toBeVisible();
    expect(bodyOf(fetchMock, 'POST', '/api/workouts')).toEqual({ routine_id: 'push' });
  });
});

describe('Train: logging', () => {
  it('saves a logged set and shows the server’s live points', async () => {
    const fetchMock = trainApi({
      'GET /api/workouts/active': [200, makeWorkout()],
      'PUT /api/workouts/w1': () => [200, makeWorkout({ live_points: 58 })],
    });
    renderApp('/train');
    const bench = await screen.findByRole('article', { name: 'Bench press' });
    await userEvent.click(within(bench).getByRole('button', { name: /^Repeat .* on set 1$/ }));
    expect(within(bench).getByLabelText('Bench press, set 1, disks')).toHaveValue(72.5);
    await waitFor(() => expect(screen.getByTestId('live-points')).toHaveTextContent('58'), {
      timeout: 5000,
    });
    const body = bodyOf(fetchMock, 'PUT', '/api/workouts/w1') as {
      exercises: { sets: { done: boolean }[] }[];
    };
    expect(body.exercises[0]?.sets[0]?.done).toBe(true);
    // Logging a set doesn't start anything: the rest timer is yours to start.
    expect(screen.queryByRole('timer', { name: 'Rest' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Rest 1:30' }));
    expect(screen.getByRole('timer', { name: 'Rest' })).toHaveTextContent('1:30');
    await userEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(screen.queryByRole('timer', { name: 'Rest' })).toBeNull();
    expect(screen.queryByTestId('rest-flash')).toBeNull();
  });

  it('finds exercises by Spanish alias and adds them', async () => {
    trainApi({ 'GET /api/workouts/active': [200, makeWorkout({ exercises: [] })] });
    renderApp('/train');
    await userEvent.click(await screen.findByRole('button', { name: 'Add exercise' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add exercise' });
    await userEvent.type(within(dialog).getByRole('searchbox'), 'sentadilla');
    expect(within(dialog).queryByRole('button', { name: 'Bench press' })).toBeNull();
    await userEvent.click(within(dialog).getByRole('button', { name: /^Back squat/ }));
    expect(await screen.findByRole('article', { name: /^Back squat/ })).toBeVisible();
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
    expect(within(dialog).getByText('Bar 20 kg + disks 72.5 kg = 92.5 kg')).toBeVisible();
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
    expect(within(dialog).getByText('New PR: Bench press 72.5 kg + bar × 5')).toBeVisible();
    expect(within(dialog).getByText('Better than last time (+3%)')).toBeVisible();
    expect(
      within(dialog).getByText('+3% volume vs last time. Better than yesterday.'),
    ).toBeVisible();
    expect(within(dialog).getByText('+100')).toBeVisible();
    expect(within(dialog).getByText(/213/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'See ATUS Climb' }));
    expect(await screen.findByRole('heading', { level: 1, name: /Better than/ })).toBeVisible();
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
