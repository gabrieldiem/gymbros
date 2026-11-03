import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { DayRange } from '../src/features/steps/stepDates';
import { addDays, fromDay, rangeIsFree, toDay } from '../src/features/steps/stepDates';
import { createQueryClient } from '../src/api/queryClient';
import { StepsChart } from '../src/features/steps/StepsChart';
import { Providers } from '../src/Providers';
import { makeMe, mockApi, renderApp } from './renderApp';

// A stand-in that offers one period; the real calendar runs in the e2e tests.
vi.mock('../src/features/steps/StepsCalendar', () => ({
  default: ({ onChange }: { onChange: (range: DayRange) => void }) => (
    <button type="button" onClick={() => onChange({ start: '2026-11-01', end: '2026-11-03' })}>
      pick a period
    </button>
  ),
}));
vi.mock('../src/features/climb/TrailMap', () => ({
  TrailMap: ({
    standings,
    campStep,
    campValue,
  }: {
    standings: { display_name: string; points: number }[];
    campStep: number;
    campValue?: (value: number) => string;
  }) => (
    <div data-testid="map">
      {standings.map((s) => `${s.display_name}:${s.points}`).join()}|{campValue?.(campStep)}
    </div>
  ),
}));

const PAGE = {
  mode: 'week',
  summit: 70000,
  camp_step: 11666,
  steps_per_point: 250,
  daily_cap: 20000,
  today: '2026-11-03',
  earliest: '2026-10-27',
  taken_days: ['2026-11-02'],
  standings: [
    {
      user_id: 'u2',
      display_name: 'Maxo',
      initials: 'MX',
      color: 'red',
      steps: 9000,
      position: 1,
      is_me: false,
    },
    {
      user_id: 'u1',
      display_name: 'Gabi',
      initials: 'GA',
      color: 'volt',
      steps: 5000,
      position: 2,
      is_me: true,
    },
  ],
  last_days: Array.from({ length: 14 }, (_, i) => ({
    day: addDays('2026-11-03', i - 13),
    steps: i * 1000,
  })),
  my_week: 12345,
  my_total: 54321,
  my_best_day: 13000,
  entries: [
    {
      id: 'e1',
      start_date: '2026-11-02',
      end_date: '2026-11-02',
      steps: 5000,
      points: 20,
      removable: true,
    },
    {
      id: 'e2',
      start_date: '2026-10-28',
      end_date: '2026-10-29',
      steps: 8000,
      points: 32,
      removable: false,
    },
  ],
};

const open = (routes = {}) => {
  const fetchMock = mockApi({
    'GET /api/me': [200, makeMe()],
    'GET /api/steps?mode=week': [200, PAGE],
    'GET /api/steps?mode=all': [200, { ...PAGE, mode: 'all', summit: 1500000 }],
    ...routes,
  });
  renderApp('/climb/steps');
  return fetchMock;
};
const bodyOf = (fetchMock: ReturnType<typeof mockApi>) =>
  JSON.parse(
    String(fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')?.[1]?.body),
  ) as unknown;

describe('Dates on the steps calendar', () => {
  it('don’t go through a time zone', () => {
    expect(toDay(fromDay('2026-11-03'))).toBe('2026-11-03');
    expect(addDays('2026-11-01', -1)).toBe('2026-10-31');
  });

  it('know whether a period is free', () => {
    const taken = ['2026-11-02'];
    expect(rangeIsFree({ start: '2026-11-03', end: '2026-11-03' }, taken)).toBe(true);
    expect(rangeIsFree({ start: '2026-11-01', end: '2026-11-03' }, taken)).toBe(false);
  });
});

describe('The steps page', () => {
  it('shows the crew on the mountain, in steps, and your numbers', async () => {
    open();
    expect(await screen.findByRole('heading', { level: 1, name: 'Steps' })).toBeVisible();
    expect(await screen.findByTestId('map')).toHaveTextContent('Maxo:9000,Gabi:5000');
    expect(screen.getByTestId('map')).toHaveTextContent('11,666 steps');
    expect(screen.getByText('12,345')).toBeVisible();
    expect(screen.getByText(/^1 point every 250 steps, up to 20,000 a day/)).toBeVisible();
  });

  it('switches to all time', async () => {
    const fetchMock = open();
    await screen.findByTestId('map');
    await userEvent.click(screen.getByRole('button', { name: /all time/i }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.map(([url]) => String(url))).toContain('/api/steps?mode=all'),
    );
  });

  it('can’t save until there are days and a number', async () => {
    open();
    const save = await screen.findByRole('button', { name: 'Save steps' });
    expect(save).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Today' }));
    expect(save).toBeDisabled();
    await userEvent.type(screen.getByRole('spinbutton', { name: 'Steps' }), '10000');
    expect(save).toBeEnabled();
  });

  it('logs today in one tap, and says what it paid', async () => {
    const fetchMock = open({
      'POST /api/steps': [
        201,
        { id: 'e9', start_date: '2026-11-03', end_date: '2026-11-03', steps: 10000, points: 40 },
      ],
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Today' }));
    await userEvent.type(screen.getByRole('spinbutton', { name: 'Steps' }), '10000');
    await userEvent.click(screen.getByRole('button', { name: 'Save steps' }));
    await waitFor(() =>
      expect(bodyOf(fetchMock)).toEqual({
        start_date: '2026-11-03',
        end_date: '2026-11-03',
        steps: 10000,
      }),
    );
    expect(await screen.findByText('Steps saved: +40 pts')).toBeVisible();
  });

  it('logs a period as one total', async () => {
    const fetchMock = open({
      'POST /api/steps': [
        201,
        { id: 'e9', start_date: '2026-11-01', end_date: '2026-11-03', steps: 30000, points: 120 },
      ],
    });
    await userEvent.click(await screen.findByRole('button', { name: 'pick a period' }));
    expect(screen.getByText(/, 3 days$/)).toBeVisible();
    await userEvent.type(screen.getByRole('spinbutton', { name: 'Steps in total' }), '30000');
    await userEvent.click(screen.getByRole('button', { name: 'Save steps' }));
    await waitFor(() =>
      expect(bodyOf(fetchMock)).toEqual({
        start_date: '2026-11-01',
        end_date: '2026-11-03',
        steps: 30000,
      }),
    );
  });

  it('won’t offer a shortcut onto a day already logged', async () => {
    open();
    expect(await screen.findByRole('button', { name: 'Yesterday' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Last 3 days' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Today' })).toBeEnabled();
  });

  it('says why when a day is taken', async () => {
    open({ 'POST /api/steps': [409, { detail: { code: 'steps_day_taken' } }] });
    await userEvent.click(await screen.findByRole('button', { name: 'Today' }));
    await userEvent.type(screen.getByRole('spinbutton', { name: 'Steps' }), '10');
    await userEvent.click(screen.getByRole('button', { name: 'Save steps' }));
    expect(await screen.findByText(/already has steps/)).toBeVisible();
  });

  it('lets you take back what’s recent, and only that', async () => {
    const fetchMock = open({ 'DELETE /api/steps/e1': [204, null] });
    await userEvent.click(await screen.findByRole('button', { name: 'Remove 5,000 steps' }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(true),
    );
    expect(screen.queryByRole('button', { name: 'Remove 8,000 steps' })).toBeNull();
  });
});

describe('The steps chart', () => {
  it('has a table for screen readers and says each day’s steps', async () => {
    mockApi({ 'GET /api/me': [200, makeMe()] });
    render(
      <Providers client={createQueryClient()}>
        <StepsChart days={PAGE.last_days} dailyCap={20000} />
      </Providers>,
    );
    const table = await screen.findByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(14);
    expect(within(table).getByText('13,000')).toBeInTheDocument();
  });
});

describe('Switching between the climb and steps', () => {
  const climb = {
    mode: 'all',
    camp_step: 1500,
    summit: 9000,
    weekly_target: 3,
    standings: [],
    me: {
      points: 0,
      position: 1,
      camp: 0,
      workouts_this_week: 0,
      goal_streak: 0,
      to_next_camp: 1500,
      gap_above: null,
      lead_below: null,
      above: null,
      below: null,
    },
    improvement: { strength_pct: null, volume_pct: null, workouts: 0, workouts_before: 0 },
  };

  it('goes both ways in one tap, keeping the Climb tab lit', async () => {
    open({
      'GET /api/climb?mode=all': [200, climb],
      'GET /api/climb?mode=week': [200, climb],
    });
    const views = within(await screen.findByRole('navigation', { name: 'Climb view' }));
    expect(views.getByRole('link', { name: 'Steps' })).toHaveAttribute('aria-current', 'page');
    expect(
      within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', {
        name: 'ATUS Climb',
      }),
    ).toHaveAttribute('aria-current', 'page');

    await userEvent.click(views.getByRole('link', { name: 'Climb' }));
    const back = within(await screen.findByRole('navigation', { name: 'Climb view' }));
    expect(back.getByRole('link', { name: 'Climb' })).toHaveAttribute('aria-current', 'page');
    expect(back.getByRole('link', { name: 'Climb' })).toHaveAttribute('href', '/climb');

    await userEvent.click(back.getByRole('link', { name: 'Steps' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Steps' })).toBeVisible();
  });

  it('still answers at the old address', async () => {
    mockApi({
      'GET /api/me': [200, makeMe()],
      'GET /api/steps?mode=week': [200, PAGE],
    });
    renderApp('/steps');
    expect(await screen.findByRole('heading', { level: 1, name: 'Steps' })).toBeVisible();
  });
});
