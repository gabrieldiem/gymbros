import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { columnPath, heatLevel, niceMax } from '../src/features/me/charts';
import { lineItemText } from '../src/features/train/format';
import { formatNumber, translate } from '../src/i18n/translate';
import { CLIMB_ALL } from './climbFixtures';
import { BADGES, BOARD, DUEL_IN, RECAP, STATS } from './competeFixtures';
import { makeMe, mockApi, renderApp } from './renderApp';
import { CATALOG } from './trainFixtures';

function api(extra: Parameters<typeof mockApi>[0] = {}) {
  return mockApi({
    'GET /api/me': [200, makeMe()],
    'GET /api/catalog': [200, CATALOG],
    'GET /api/quests': [200, BOARD],
    'GET /api/badges': [200, BADGES],
    'GET /api/duels': [200, []],
    'GET /api/notifications': [200, { items: [], unread: 0 }],
    'GET /api/workouts/active': [200, null],
    'GET /api/climb?mode=all': [200, CLIMB_ALL],
    'GET /api/crew/training-now': [200, []],
    'GET /api/recap': [200, RECAP],
    'GET /api/me/stats': [200, STATS],
    ...extra,
  });
}

describe('Quests tab', () => {
  it('shows the crew quest, event, bounty and weekly quests', async () => {
    api();
    renderApp('/quests');
    const crew = await screen.findByRole('region', { name: 'Crew climbs 4,000 pts this week' });
    expect(crew).toHaveTextContent('1,345 pts to go.');
    expect(within(crew).getByText(/Maxo 620/)).toBeVisible();
    expect(screen.getByText('This week: Leg day x2')).toBeVisible();
    expect(screen.getByText(/Maxo leads with 4,310 pts/)).toBeVisible();
    const legs = screen.getByRole('progressbar', { name: 'Leg day, twice' });
    expect(legs).toHaveAttribute('aria-valuenow', '1');
    expect(screen.getByText('1 of 2')).toBeVisible();
    expect(screen.getByText('12.4 of 20 t')).toBeVisible();
    expect(screen.getByText('Complete')).toBeVisible();
  });

  it('accepts a duel you were challenged to', async () => {
    const fetchMock = api({
      'GET /api/duels': [200, [DUEL_IN]],
      'POST /api/duels/d1/accept': [200, { ...DUEL_IN, status: 'active' }],
    });
    renderApp('/quests');
    const duel = await screen.findByRole('article', { name: 'Bench duel with Maxo' });
    expect(duel).toHaveTextContent('Maxo challenged you.');
    expect(duel).toHaveTextContent('Loser buys the protein shakes.');
    await userEvent.click(within(duel).getByRole('button', { name: 'Accept' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/duels/d1/accept',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
  });

  it('sends a challenge', async () => {
    const fetchMock = api({ 'POST /api/duels': [201, DUEL_IN] });
    renderApp('/quests');
    await userEvent.click(await screen.findByRole('button', { name: 'Start a duel' }));
    const sheet = screen.getByRole('dialog', { name: 'Start a duel' });
    await userEvent.click(within(sheet).getByRole('button', { name: /Matex/ }));
    await userEvent.click(within(sheet).getByRole('button', { name: 'Bench volume' }));
    await userEvent.click(
      within(sheet).getByRole('button', { name: 'Loser buys the post-gym burritos.' }),
    );
    await userEvent.click(within(sheet).getByRole('button', { name: 'Send challenge' }));
    expect(await screen.findByText('Duel request sent to Matex.')).toBeVisible();
    const call = fetchMock.mock.calls.find(([u, i]) => u === '/api/duels' && i?.method === 'POST');
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      opponent_id: 'matex',
      metric: 'bench_volume',
      stake: 'stake_burritos',
    });
  });

  it('lists badges with progress and details', async () => {
    api();
    renderApp('/quests');
    await userEvent.click(await screen.findByRole('button', { name: 'Badges' }));
    expect(screen.getByText('You have 1 of 2. Each one pays out once.')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Hundred tonnes, Locked' }));
    const sheet = screen.getByRole('dialog', { name: 'Hundred tonnes' });
    expect(sheet).toHaveTextContent('Move 100 tonnes in total.');
    expect(sheet).toHaveTextContent('82.4 / 100');
    expect(sheet).toHaveTextContent('+150 pts, once');
    expect(sheet).toHaveTextContent('3 have it');
  });
});

describe('Weekly recap', () => {
  it('opens from ATUS Climb and steps through the slides', async () => {
    api();
    renderApp('/climb');
    await userEvent.click(await screen.findByRole('button', { name: /Last week/ }));
    const story = await screen.findByRole('dialog', { name: 'Weekly recap' });
    expect(story).toHaveTextContent('4,870');
    await userEvent.click(within(story).getByRole('button', { name: 'Next slide' }));
    expect(story).toHaveTextContent('Santi');
    expect(story).toHaveTextContent('+812 pts, 5 workouts');
    await userEvent.click(within(story).getByRole('button', { name: 'Next slide' }));
    expect(story).toHaveTextContent('110 kg');
    expect(story).toHaveTextContent('Maxo, Bench press 110 kg × 3');
    await userEvent.click(within(story).getByRole('button', { name: 'Next slide' }));
    expect(story).toHaveTextContent('4 / 3');
    expect(story).toHaveTextContent('From 3rd to 2nd on the rope.');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Weekly recap' })).toBeNull();
  });
});

describe('You tab', () => {
  it('shows stats, improvement, charts, PRs, ladder and history', async () => {
    api();
    renderApp('/me');
    expect(await screen.findByRole('heading', { level: 1, name: 'Gabi' })).toBeVisible();
    expect(screen.getByText('2nd on ATUS Climb, Iron')).toBeVisible();
    expect(screen.getByText('64')).toBeVisible();
    expect(screen.getByRole('region', { name: 'You vs 4 weeks ago' })).toHaveTextContent('+11%');
    expect(screen.getByRole('img', { name: 'Weekly tonnage' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Weekly tonnage' })).toHaveTextContent('21.3 t');
    expect(screen.getByRole('region', { name: 'Rank ladder' })).toHaveTextContent(
      'Steel620 pts to go',
    );
    expect(screen.getByRole('region', { name: 'History' })).toHaveTextContent(
      '19 sets, 9,450 kg, 72 min',
    );
  });

  it('opens a PR progress chart', async () => {
    api({
      'GET /api/me/prs/squat': [
        200,
        [
          { week_start: '2026-09-07', e1rm: 145 },
          { week_start: '2026-10-05', e1rm: 150.5 },
          { week_start: '2026-10-19', e1rm: 154 },
        ],
      ],
    });
    renderApp('/me');
    await userEvent.click(await screen.findByRole('button', { name: /Back squat/ }));
    const sheet = screen.getByRole('dialog', { name: 'Back squat' });
    expect(await within(sheet).findByRole('table')).toHaveTextContent('est. 1RM 150.5 kg');
  });

  it('changes the rest timer in settings', async () => {
    const fetchMock = api({ 'PATCH /api/me': (body) => [200, makeMe(body as object)] });
    renderApp('/me');
    await userEvent.click(await screen.findByRole('button', { name: 'Settings' }));
    await userEvent.click(screen.getByRole('button', { name: '120 s' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/me',
        expect.objectContaining({ body: '{"rest_seconds":120}' }),
      ),
    );
  });
});

describe('chart helpers and new line items', () => {
  it('draws columns with a rounded top and square base', () => {
    expect(columnPath(0, 10, 24, 50)).toBe('M0 60 V14 Q0 10 4 10 H20 Q24 10 24 14 V60 Z');
    expect(columnPath(0, 0, 24, 0)).toBe('');
  });

  it('rounds axis maxima', () => {
    expect([niceMax(0), niceMax(4), niceMax(18.6), niceMax(130)]).toEqual([1, 5, 20, 200]);
    expect([heatLevel(0), heatLevel(1), heatLevel(2)]).toEqual([0, 2, 3]);
  });

  it('renders quest, crew quest, bounty, badge and duel line items', () => {
    const t = translate.bind(null, 'es');
    const n = (v: number) => formatNumber('es', v);
    const item = (key: string, vars: Record<string, string | number> = {}) => ({
      key,
      vars,
      points: 0,
    });
    expect(lineItemText(item('ln_quest', { quest: 'legs2' }), [], t, n)).toBe(
      'Reto completado: Leg day, dos veces',
    );
    expect(lineItemText(item('ln_crew_quest'), [], t, n)).toBe('Reto de equipo completado');
    expect(lineItemText(item('ln_bounty', { name: 'Maxo' }), [], t, n)).toBe(
      'Recompensa cobrada: pasaste a Maxo',
    );
    expect(lineItemText(item('ln_badge', { badge: 'first' }), [], t, n)).toBe(
      'Insignia: Primeros pasos',
    );
    expect(lineItemText(item('ln_duel', { name: 'Santi' }), [], t, n)).toBe('Duelo ganado a Santi');
  });
});
