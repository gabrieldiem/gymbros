import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { inboxKey, type Inbox } from '../src/api/social';
import { FEED, HOF, INBOX, WORKOUT_POST } from './crewFixtures';
import { makeMe, mockApi, renderApp } from './renderApp';
import { CATALOG } from './trainFixtures';

function crewApi(extra: Parameters<typeof mockApi>[0] = {}) {
  return mockApi({
    'GET /api/me': [200, makeMe()],
    'GET /api/catalog': [200, CATALOG],
    'GET /api/feed': [200, FEED],
    'GET /api/crew/hall-of-fame': [200, HOF],
    'GET /api/notifications': [200, { items: [], unread: 0 }],
    'GET /api/workouts/active': [200, null],
    ...extra,
  });
}

function lastBody(fetchMock: ReturnType<typeof mockApi>, url: string) {
  const call = [...fetchMock.mock.calls].reverse().find(([u]) => u === url);
  return call ? (JSON.parse(String(call[1]?.body)) as unknown) : undefined;
}

describe('Crew feed', () => {
  it('shows workout posts with stats, PRs, exercises and comments', async () => {
    crewApi();
    renderApp('/crew');
    expect(await screen.findByRole('heading', { level: 1, name: 'Crew' })).toBeVisible();
    expect(screen.getByText('What Iron Ridge has been up to.')).toBeVisible();
    const post = (await screen.findByRole('heading', { name: 'Push day' })).closest(
      'li',
    ) as HTMLElement;
    expect(post).toHaveTextContent('Maxo');
    expect(post).toHaveTextContent('+198');
    expect(post).toHaveTextContent('64 min');
    expect(post).toHaveTextContent('6,820 kg');
    expect(post).toHaveTextContent('+6% volume');
    expect(post).toHaveTextContent('New PR: Bench press 110 kg × 3');
    expect(post).toHaveTextContent('110×3, 105×5');
    await userEvent.click(within(post).getByRole('button', { name: '1 comments' }));
    expect(within(post).getByText('Light weight baby')).toBeVisible();
    expect(screen.getByText(/reached Iron rank/)).toBeVisible();
  });

  it('toggles a reaction optimistically and sends it', async () => {
    const fetchMock = crewApi({
      'POST /api/feed/f1/reactions': [200, { fist: 3, fire: 3, mine: ['fire'] }],
    });
    renderApp('/crew');
    const fire = await screen.findByRole('button', { name: 'Fire, 2' });
    await userEvent.click(fire);
    expect(await screen.findByRole('button', { name: 'Fire, 3' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(lastBody(fetchMock, '/api/feed/f1/reactions')).toEqual({ kind: 'fire' });
  });

  it('shows counts instead of buttons on your own posts', async () => {
    crewApi({ 'GET /api/feed': [200, { ...FEED, items: [{ ...WORKOUT_POST, is_mine: true }] }] });
    renderApp('/crew');
    const post = (await screen.findByRole('heading', { name: 'Push day' })).closest(
      'li',
    ) as HTMLElement;
    expect(within(post).queryByRole('button', { name: /Fire/ })).toBeNull();
    expect(post).toHaveTextContent('👊 3');
  });

  it('sends a quick reply and shows it in the thread', async () => {
    const fetchMock = crewApi({
      'POST /api/feed/f1/comments': [
        201,
        {
          id: 'c2',
          author: { user_id: 'u1', display_name: 'Gabi', initials: 'GA', color: 'volt' },
          body: null,
          quick_key: 'q_respect',
          created_at: new Date().toISOString(),
        },
      ],
    });
    renderApp('/crew');
    const post = (await screen.findByRole('heading', { name: 'Push day' })).closest(
      'li',
    ) as HTMLElement;
    await userEvent.click(within(post).getByRole('button', { name: '1 comments' }));
    await userEvent.click(within(post).getByRole('button', { name: 'Respect 🫡' }));
    expect(await within(post).findAllByText('Respect 🫡')).toHaveLength(2);
    expect(lastBody(fetchMock, '/api/feed/f1/comments')).toEqual({ quick_key: 'q_respect' });
  });

  it('nudges an inactive member and confirms with a toast', async () => {
    const fetchMock = crewApi({ 'POST /api/crew/nudges': [201, { user_id: 'matex' }] });
    renderApp('/crew');
    expect(await screen.findByText(/hasn’t logged a workout in 3 days/)).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Nudge' }));
    expect(await screen.findByText('Nudge sent to Matex.')).toBeVisible();
    expect(lastBody(fetchMock, '/api/crew/nudges')).toEqual({ user_id: 'matex' });
  });

  it('explains an empty feed', async () => {
    crewApi({ 'GET /api/feed': [200, { items: [], inactive: [], next_before: null }] });
    renderApp('/crew');
    expect(await screen.findByText(/Finish a workout and it shows up for the crew/)).toBeVisible();
  });
});

describe('Hall of fame', () => {
  it('shows the most improved podium and crew records', async () => {
    crewApi();
    renderApp('/crew');
    await userEvent.click(await screen.findByRole('button', { name: 'Hall of fame' }));
    const improved = await screen.findByRole('region', { name: 'Most improved this month' });
    expect(improved).toHaveTextContent('Matex');
    expect(improved).toHaveTextContent('+18%');
    const records = screen.getByRole('region', { name: 'Crew records' });
    expect(records).toHaveTextContent('Heaviest Back squat');
    expect(records).toHaveTextContent('140 kg × 3');
    expect(records).toHaveTextContent('You hold this one');
    expect(records).toHaveTextContent('14 weeks');
    expect(records).toHaveTextContent('412 pts');
  });
});

describe('Notifications', () => {
  it('shows the unread count, opens the inbox and marks it read', async () => {
    const fetchMock = crewApi({
      'GET /api/notifications': [200, INBOX],
      'POST /api/notifications/read': [204, null],
    });
    renderApp('/crew');
    await userEvent.click(await screen.findByRole('button', { name: 'Alerts, 1 unread' }));
    const dialog = screen.getByRole('dialog', { name: 'Alerts' });
    expect(dialog).toHaveTextContent('Maxo passed you on ATUS Climb. Go get it back.');
    expect(dialog).toHaveTextContent('Santi reacted 🔥 to your workout.');
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/notifications/read',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    expect(screen.getByRole('button', { name: 'Alerts' })).toBeInTheDocument();
  });

  it('toasts a notification that arrives after the first load', async () => {
    crewApi();
    const { client } = renderApp('/crew');
    await screen.findByRole('button', { name: 'Alerts' });
    await waitFor(() => expect(client.getQueryData(inboxKey)).toBeDefined());
    act(() => client.setQueryData<Inbox>(inboxKey, INBOX));
    expect(await screen.findByText('Maxo passed you on ATUS Climb. Go get it back.')).toBeVisible();
  });
});
