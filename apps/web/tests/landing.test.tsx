import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { rankSample } from '../src/features/landing/sampleCrew';
import { CREW, makeMe, mockApi, renderApp, SIGNED_OUT } from './renderApp';

const OPTIONS = [200, { google: true, dev_login: false }] as [number, unknown];
const POINTS = {
  showed_up: 50,
  completed_set: 5,
  leg_event_set_bonus: 5,
  volume_kg_per_point: 100,
  cardio_minute: 2,
  cardio_effort_km: 8,
  pr: 100,
  weekly_goal: 150,
  goal_streak_per_week: 20,
  goal_streak_max: 100,
  over_target: 50,
  better_than_last_time: 25,
  steps_per_point: 250,
  steps_daily_cap: 20000,
  stretching: 25,
  weekly_target: 3,
  bodyweight_kg: 80,
};
const LIFT_LINES = [
  { key: 'ln_show', vars: {}, points: 50 },
  { key: 'ln_sets', vars: { n: 16 }, points: 80 },
  { key: 'ln_vol', vars: { kg: 12000 }, points: 120 },
];
const RULES: [number, unknown] = [
  200,
  {
    points: POINTS,
    crew_quest: 200,
    crew_quest_goal: 4000,
    bounty: 150,
    duel_win: 150,
    rank_step: 1500,
    rank_count: 7,
    swim_km_factor: 4,
    quests: [{ id: 'distance', goal: 20, bonus: 200 }],
    badges: [
      { id: 'tenk', goal: 10, points: 200, icon: 'boot', color: '#00D1FF' },
      { id: 'mile', goal: 1.5, points: 200, icon: 'loop', color: '#FF4FD8' },
    ],
    sessions: [
      { id: 'lift', minutes: 60, km: null, tonnes: 12, total: 250, line_items: LIFT_LINES },
      { id: 'run', minutes: 60, km: 10, tonnes: null, total: 255, line_items: [] },
      { id: 'swim', minutes: 60, km: 2.5, tonnes: null, total: 255, line_items: [] },
    ],
  },
];

describe('Landing page', () => {
  it('shows the dashboard to signed-out visitors with a made-up crew', async () => {
    mockApi({ 'GET /api/me': SIGNED_OUT, 'GET /api/auth/options': OPTIONS });
    renderApp('/');
    await screen.findByRole('heading', { level: 1, name: 'Climb with your crew.' });
    const rope = within(screen.getByRole('region', { name: 'Rope order' }));
    expect(rope.getAllByRole('listitem')).toHaveLength(5);
    for (const name of ['Sam', 'Jordan', 'Riley', 'Casey'])
      expect(rope.getByText(name)).toBeVisible();
    expect(rope.getByText('Alex (You)')).toBeVisible();
    expect(screen.getByText('A sample crew. The names and points are made up.')).toBeVisible();
  });

  it('never shows the real crew', async () => {
    mockApi({ 'GET /api/me': SIGNED_OUT, 'GET /api/auth/options': OPTIONS });
    renderApp('/');
    await screen.findByRole('heading', { level: 1, name: 'Climb with your crew.' });
    for (const name of ['Gabi', 'Santi', 'Maxo', 'Jose', 'Matex']) {
      expect(document.body.textContent).not.toContain(name);
    }
  });

  it('has a place to log in and a way to sign in', async () => {
    mockApi({ 'GET /api/me': SIGNED_OUT, 'GET /api/auth/options': OPTIONS });
    renderApp('/');
    expect(await screen.findByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');
    expect(screen.getAllByRole('link', { name: 'Continue with Google' })[0]).toBeVisible();
  });

  it('links to the repository and the legal pages in the footer', async () => {
    mockApi({ 'GET /api/me': SIGNED_OUT, 'GET /api/auth/options': OPTIONS });
    renderApp('/');
    await screen.findByRole('heading', { level: 1, name: 'Climb with your crew.' });
    const footer = within(screen.getByRole('contentinfo'));
    expect(footer.getByRole('link', { name: 'Source code on GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/gabrieldiem/gymbros',
    );
    expect(footer.getByRole('link', { name: 'Privacy policy' })).toHaveAttribute(
      'href',
      '/privacy',
    );
    expect(footer.getByRole('link', { name: 'Terms of service' })).toHaveAttribute(
      'href',
      '/terms',
    );
  });

  it('lists what every task pays, from the API', async () => {
    mockApi({ 'GET /api/me': SIGNED_OUT, 'GET /api/rules': RULES });
    renderApp('/');
    const points = within(await screen.findByRole('region', { name: 'What every task pays' }));
    expect(points.getByText('Log a workout').parentElement).toHaveTextContent('+50');
    expect(points.getByText('A new personal record').parentElement).toHaveTextContent('+100');
    expect(points.getByText('Run 20 km or swim 5 km').parentElement).toHaveTextContent('+200');
    expect(points.getByText('Win a duel').parentElement).toHaveTextContent('+150');
  });

  it('lists every achievement with its points', async () => {
    mockApi({ 'GET /api/me': SIGNED_OUT, 'GET /api/rules': RULES });
    renderApp('/');
    const list = within(await screen.findByRole('region', { name: '2 achievements' }));
    expect(list.getByText('Ten K')).toBeVisible();
    expect(list.getByText('Swim 1.5 km in one go.')).toBeVisible();
    expect(list.getAllByText('+200')).toHaveLength(2);
  });

  it('compares an hour of each sport', async () => {
    mockApi({ 'GET /api/me': SIGNED_OUT, 'GET /api/rules': RULES });
    renderApp('/');
    const sports = within(await screen.findByRole('region', { name: 'An hour is an hour' }));
    expect(sports.getByRole('heading', { name: 'Swim' })).toBeVisible();
    expect(sports.getByText(/2\.5 km/)).toBeVisible();
    expect(sports.getByText('250 pts')).toBeVisible();
  });

  it('lets a visitor finish a sample workout and pass someone', async () => {
    mockApi({ 'GET /api/me': SIGNED_OUT, 'GET /api/rules': RULES });
    renderApp('/');
    const button = await screen.findByRole('button', { name: 'Finish Alex’s workout' });
    await screen.findByRole('region', { name: 'An hour is an hour' });
    await userEvent.click(button);
    expect(screen.getByText('Alex passed Jordan!')).toBeVisible();
    expect(screen.getByText('16 completed sets')).toBeVisible();
    const rope = within(screen.getByRole('region', { name: 'Rope order' }));
    expect(rope.getAllByRole('listitem')[1]).toHaveTextContent('Alex (You)');
  });

  it('ranks the sample crew by points', () => {
    expect(rankSample(0, 0).map((s) => s.display_name)).toEqual([
      'Sam',
      'Jordan',
      'Alex',
      'Riley',
      'Casey',
    ]);
    const top = rankSample(800, 2)[0];
    expect(top?.display_name).toBe('Alex');
    expect(top?.position).toBe(1);
    expect(top?.workouts_this_week).toBe(4);
  });

  it('still renders when the API is down', async () => {
    mockApi({ 'GET /api/me': [503, {}] });
    renderApp('/');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Climb with your crew.' }),
    ).toBeVisible();
  });

  it('sends members to the app and members without a crew to join', async () => {
    mockApi({ 'GET /api/me': [200, makeMe({ crew: CREW })] });
    const { unmount } = renderApp('/');
    expect(await screen.findByRole('heading', { level: 1, name: /Better than/ })).toBeVisible();
    unmount();
    mockApi({ 'GET /api/me': [200, makeMe({ crew: null })] });
    renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Join your crew' })).toBeVisible();
  });
});
