import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { makeMe, mockApi, mockFetchJson, renderApp, SIGNED_OUT } from './renderApp';

describe('App shell (signed in)', () => {
  it('redirects / to ATUS Climb', async () => {
    mockApi({ 'GET /api/me': [200, makeMe()] });
    renderApp('/');
    expect(await screen.findByRole('heading', { level: 1, name: /Better than/ })).toBeVisible();
  });

  it('shows the five tabs with Train in the middle', async () => {
    mockApi({ 'GET /api/me': [200, makeMe()] });
    renderApp('/climb');
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    const tabs = within(nav)
      .getAllByRole('link')
      .filter((link) => !link.hasAttribute('aria-label'))
      .map((link) => link.textContent);
    expect(tabs).toEqual([
      'ATUS Climb',
      'Crew',
      'Train',
      'Quests',
      'This week',
      'Achievements',
      'Points',
      'You',
    ]);
  });

  it('marks the current tab', async () => {
    mockApi({ 'GET /api/me': [200, makeMe()] });
    renderApp('/quests');
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Quests' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('shows the avatar with initials, opening the profile menu', async () => {
    mockApi({ 'GET /api/me': [200, makeMe({ initials: 'GD' })] });
    renderApp('/climb');
    const button = await screen.findByRole('button', { name: /Your profile/ });
    expect(button).toHaveAttribute('aria-haspopup', 'menu');
    expect(button).toHaveTextContent('GD');
  });

  it('switches the language and stores it on the profile', async () => {
    const fetchMock = mockApi({
      'GET /api/me': [200, makeMe()],
      'PATCH /api/me': (body) => [200, makeMe(body as object)],
    });
    renderApp('/crew');
    await userEvent.click(await screen.findByRole('button', { name: 'ES' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Equipo' })).toBeVisible();
    expect(document.documentElement.lang).toBe('es');
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/me',
        expect.objectContaining({ method: 'PATCH', body: '{"language":"es"}' }),
      ),
    );
  });

  it('uses the language stored on the profile', async () => {
    mockApi({ 'GET /api/me': [200, makeMe({ language: 'es' })] });
    renderApp('/quests');
    expect(await screen.findByRole('heading', { level: 1, name: 'Retos' })).toBeVisible();
  });

  it('shows a not-found page for unknown paths', async () => {
    mockApi({ 'GET /api/me': [200, makeMe()] });
    renderApp('/nope');
    expect(await screen.findByRole('heading', { level: 1, name: 'Off the trail' })).toBeVisible();
  });

  it('shows a retry screen when the session cannot be loaded', async () => {
    mockFetchJson(500, { detail: 'boom' });
    renderApp('/climb');
    expect(await screen.findByText('Couldn’t load your account.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible();
  });
});

describe('Route gates', () => {
  it('sends signed-out visitors to the welcome screen', async () => {
    mockApi({ 'GET /api/me': SIGNED_OUT });
    renderApp('/climb');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Climb with your crew.' }),
    ).toBeVisible();
    expect(screen.getAllByRole('link', { name: 'Continue with Google' })[0]).toHaveAttribute(
      'href',
      '/api/auth/google/start?lang=en',
    );
  });

  it('sends members without a crew to the join screen', async () => {
    mockApi({ 'GET /api/me': [200, makeMe({ crew: null })] });
    renderApp('/climb');
    expect(await screen.findByRole('heading', { level: 1, name: 'Join your crew' })).toBeVisible();
  });

  it('sends signed-in members away from the login screen', async () => {
    mockApi({ 'GET /api/me': [200, makeMe()] });
    renderApp('/login');
    expect(await screen.findByRole('heading', { level: 1, name: /Better than/ })).toBeVisible();
  });
});

describe('HealthStatus', () => {
  it('shows online when the API and database are up', async () => {
    const fetchMock = mockApi({ 'GET /api/me': [200, makeMe()] });
    renderApp('/climb');
    expect(await screen.findByText('Server online')).toBeVisible();
    expect(fetchMock).toHaveBeenCalledWith('/api/health', expect.anything());
  });
});

describe('Quests sections', () => {
  const RULES: [number, unknown] = [
    200,
    {
      points: {
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
        stretching: 25,
        weekly_target: 3,
        bodyweight_kg: 80,
      },
      crew_quest: 200,
      crew_quest_goal: 4000,
      bounty: 150,
      duel_win: 150,
      rank_step: 1500,
      rank_count: 7,
      swim_km_factor: 4,
      quests: [{ id: 'distance', goal: 20, bonus: 200 }],
      badges: [],
      sessions: [{ id: 'swim', minutes: 60, km: 2.5, tonnes: null, total: 255, line_items: [] }],
    },
  ];
  const BADGES: [number, unknown] = [
    200,
    [
      {
        id: 'tenk',
        goal: 10,
        points: 200,
        icon: 'boot',
        color: '#00D1FF',
        progress: 4,
        unlocked_at: null,
        crew_count: 1,
      },
      {
        id: 'first',
        goal: 1,
        points: 50,
        icon: 'boot',
        color: '#7CFF4F',
        progress: 1,
        unlocked_at: '2026-10-01T10:00:00Z',
        crew_count: 5,
      },
    ],
  ];

  it('links to every section from the main nav and the section bar', async () => {
    mockApi({ 'GET /api/me': [200, makeMe()], 'GET /api/badges': BADGES });
    renderApp('/quests');
    const main = within(await screen.findByRole('navigation', { name: 'Main' }));
    expect(main.getByRole('link', { name: 'Achievements' })).toHaveAttribute(
      'href',
      '/quests/achievements',
    );
    expect(main.getByRole('link', { name: 'Points' })).toHaveAttribute('href', '/quests/points');
    const bar = within(screen.getByRole('navigation', { name: 'Quests view' }));
    expect(await bar.findByRole('link', { name: /Achievements 1\/2/ })).toBeVisible();
  });

  it('marks the section you are on', async () => {
    mockApi({ 'GET /api/me': [200, makeMe()], 'GET /api/badges': BADGES });
    renderApp('/quests/achievements');
    const main = within(await screen.findByRole('navigation', { name: 'Main' }));
    expect(main.getByRole('link', { name: 'Achievements' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(main.getByRole('link', { name: 'Quests' })).toHaveAttribute('aria-current', 'page');
    expect(main.getByRole('link', { name: 'This week' })).not.toHaveAttribute('aria-current');
  });

  it('lists each achievement with its condition, reward and your progress', async () => {
    mockApi({ 'GET /api/me': [200, makeMe()], 'GET /api/badges': BADGES });
    renderApp('/quests/achievements');
    const locked = await screen.findByRole('button', { name: /^Ten K/ });
    expect(locked).toHaveTextContent('Locked');
    expect(locked).toHaveTextContent('Run 10 km in one go.');
    expect(locked).toHaveTextContent('+200');
    expect(locked).toHaveTextContent('4 / 10');
    expect(screen.getByRole('button', { name: /^First tracks/ })).toHaveTextContent('Unlocked');
    expect(screen.getByText(/You have 1 of 2/)).toBeVisible();
  });

  it('shows what every task pays and the sports', async () => {
    mockApi({ 'GET /api/me': [200, makeMe()], 'GET /api/rules': RULES });
    renderApp('/quests/points');
    expect(await screen.findByText('A new personal record')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'An hour is an hour' })).toBeVisible();
    expect(screen.getByRole('heading', { level: 1, name: 'Points' })).toBeVisible();
  });

  it('reaches them from the profile menu', async () => {
    mockApi({
      'GET /api/me': [200, makeMe()],
      'GET /api/rules': RULES,
      'GET /api/badges': [200, []],
    });
    renderApp('/climb');
    await userEvent.click(await screen.findByRole('button', { name: /^Your profile/ }));
    expect(screen.queryByRole('menuitem', { name: 'Points' })).toBeNull();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Achievements' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Achievements' })).toBeVisible();
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
