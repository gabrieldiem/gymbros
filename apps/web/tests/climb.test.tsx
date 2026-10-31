import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ordinal } from '../src/i18n/ordinal';
import { CLIMB_ALL, CLIMB_WEEK } from './climbFixtures';
import { makeMe, mockApi, renderApp } from './renderApp';

function climbApi(extra: Parameters<typeof mockApi>[0] = {}) {
  return mockApi({
    'GET /api/me': [200, makeMe()],
    'GET /api/climb?mode=all': [200, CLIMB_ALL],
    'GET /api/climb?mode=week': [200, CLIMB_WEEK],
    'GET /api/crew/training-now': [200, []],
    'GET /api/workouts/active': [200, null],
    ...extra,
  });
}

function reduceMotion() {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('reduce'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('ATUS Climb', () => {
  it('shows the hero, the rope order and your standing', async () => {
    climbApi();
    renderApp('/climb');
    expect(await screen.findByRole('heading', { level: 1, name: /Better than/ })).toBeVisible();
    const rope = await screen.findByRole('region', { name: 'Rope order' });
    const rows = within(rope).getAllByRole('listitem');
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining('Maxo'),
      expect.stringContaining('Gabi (You)'),
      expect.stringContaining('Santi'),
    ]);
    expect(rows[0]).toHaveTextContent('4,310');
    expect(rows[2]).toHaveTextContent('Training now');

    const panel = screen.getByRole('region', { name: '2nd on ATUS Climb' });
    expect(panel).toHaveTextContent('3,880 pts');
    expect(panel).toHaveTextContent('Iron');
    expect(panel).toHaveTextContent('430 pts to catch Maxo');
    expect(panel).toHaveTextContent('155 pts ahead of Santi, who is training now');
    expect(panel).toHaveTextContent('Steel in 620 pts');
    expect(panel).toHaveTextContent('+11%');
    expect(panel).toHaveTextContent('−4%');
    expect(panel).toHaveTextContent('+3');
    expect(
      screen.getByRole('img', { name: /ATUS Climb map\. Maxo, 4,310 pts/ }),
    ).toBeInTheDocument();
  });

  it('switches to this week', async () => {
    const fetchMock = climbApi();
    renderApp('/climb');
    await screen.findByRole('region', { name: '2nd on ATUS Climb' });
    await userEvent.click(screen.getByRole('button', { name: 'This week' }));
    expect(await screen.findByRole('region', { name: '3rd on ATUS Climb' })).toHaveTextContent(
      '80 pts to catch Maxo',
    );
    expect(fetchMock).toHaveBeenCalledWith('/api/climb?mode=week', expect.anything());
    expect(screen.getByRole('button', { name: 'This week' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('lists who is training now', async () => {
    climbApi({
      'GET /api/crew/training-now': [
        200,
        [
          {
            user_id: 'santi',
            display_name: 'Santi',
            initials: 'SA',
            color: 'cyan',
            workout_name: 'Leg day',
            routine_id: 'legs',
            started_at: new Date(Date.now() - 34 * 60_000).toISOString(),
            current_exercise_id: 'squat',
          },
        ],
      ],
    });
    renderApp('/climb');
    const section = await screen.findByRole('region', { name: 'Training now' });
    expect(section).toHaveTextContent('Santi');
    expect(section).toHaveTextContent('Leg day, 34 min');
  });

  it('announces the climb after a finished workout', async () => {
    reduceMotion();
    climbApi();
    renderApp({
      pathname: '/climb',
      state: {
        climb: {
          points_before: 3700,
          points_after: 3913,
          camp_before: 2,
          camp_after: 2,
          passed: ['Santi'],
        },
      },
    });
    await waitFor(() =>
      expect(screen.getByText('You climbed 213 pts and passed Santi.')).toBeInTheDocument(),
    );
  });

  it('announces a rank up', async () => {
    reduceMotion();
    climbApi();
    renderApp({
      pathname: '/climb',
      state: {
        climb: {
          points_before: 4450,
          points_after: 4600,
          camp_before: 2,
          camp_after: 3,
          passed: [],
        },
      },
    });
    await waitFor(() =>
      expect(screen.getByText('Rank up: Steel! You climbed 150 pts.')).toBeInTheDocument(),
    );
  });

  it('shows Spanish ranks and numbers', async () => {
    climbApi({ 'GET /api/me': [200, makeMe({ language: 'es' })] });
    renderApp('/climb');
    const panel = await screen.findByRole('region', { name: '2.º en ATUS Climb' });
    expect(panel).toHaveTextContent('3.880 pts');
    expect(panel).toHaveTextContent('Hierro');
    expect(panel).toHaveTextContent('Acero a 620 pts');
  });

  it('offers a retry when the standings fail to load', async () => {
    climbApi({ 'GET /api/climb?mode=all': [500, { detail: 'boom' }] });
    renderApp('/climb');
    expect(await screen.findByText('Couldn’t load ATUS Climb.')).toBeVisible();
  });
});

describe('ordinal', () => {
  it.each([
    [1, '1st'],
    [2, '2nd'],
    [3, '3rd'],
    [4, '4th'],
    [11, '11th'],
    [21, '21st'],
  ])('%i → %s', (n, expected) => {
    expect(ordinal('en', n)).toBe(expected);
    expect(ordinal('es', n)).toBe(`${n}.º`);
  });
});
