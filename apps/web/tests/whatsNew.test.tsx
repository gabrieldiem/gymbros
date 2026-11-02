import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { inboxKey, type Inbox, type Notification } from '../src/api/social';
import { notificationText } from '../src/features/crew/format';
import { WHATS_NEW_COPY } from '../src/features/whatsnew/whatsNewCopy';
import { en } from '../src/i18n/en';
import { translate } from '../src/i18n/translate';
import { makeMe, mockApi, renderApp } from './renderApp';

const ENTRIES = [{ id: 'past-workouts', date: '2026-11-02', link: '/train' }];
const t = (key: Parameters<typeof translate>[1], vars?: Parameters<typeof translate>[2]) =>
  translate('en', key, vars);

function notice(vars: Record<string, string | number>): Notification {
  return {
    id: 'n1',
    key: 'n_whats_new',
    vars,
    link: '/whats-new',
    created_at: new Date().toISOString(),
    read: false,
    actor: null,
  };
}

describe('What’s new', () => {
  it('has copy for every entry the API can send, in both languages', () => {
    const path = resolve(__dirname, '../../api/src/resources/whats_new.json');
    const file = JSON.parse(readFileSync(path, 'utf-8')) as { entries: { id: string }[] };
    expect(file.entries.length).toBeGreaterThan(0);
    for (const { id } of file.entries) {
      const copy = WHATS_NEW_COPY[id];
      expect(copy, id).toBeDefined();
      expect(en[copy?.title ?? 'n_unknown']).toBeTruthy();
    }
  });

  it('names a single feature in the notification', () => {
    expect(notificationText(notice({ n: 1, feature: 'past-workouts' }), t)).toBe(
      'New in GYMBROS: Log a past workout.',
    );
  });

  it('rolls several features into one notification', () => {
    expect(notificationText(notice({ n: 3, feature: 'past-workouts' }), t)).toBe(
      '3 new things in GYMBROS. Take a look.',
    );
  });

  it('still says something when this copy of the app doesn’t know the feature', () => {
    expect(notificationText(notice({ n: 1, feature: 'from-the-future' }), t)).toBe(
      'There’s something new in GYMBROS.',
    );
  });

  it('lists what’s new with a way to try it', async () => {
    mockApi({ 'GET /api/me': [200, makeMe()], 'GET /api/whats-new': [200, ENTRIES] });
    renderApp('/whats-new');
    expect(await screen.findByRole('heading', { level: 1, name: 'What’s new' })).toBeVisible();
    expect(await screen.findByRole('heading', { name: 'Log a past workout' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Try it' })).toHaveAttribute('href', '/train');
  });

  it('skips an entry this copy of the app has no words for', async () => {
    mockApi({
      'GET /api/me': [200, makeMe()],
      'GET /api/whats-new': [200, [{ id: 'from-the-future', date: '2026-12-01', link: '/me' }]],
    });
    renderApp('/whats-new');
    await screen.findByRole('heading', { level: 1, name: 'What’s new' });
    await waitFor(() => expect(screen.getByRole('list', { name: '' })).toBeEmptyDOMElement());
    expect(screen.queryByRole('link', { name: 'Try it' })).toBeNull();
  });

  it('never toasts, even when other notifications do', async () => {
    mockApi({
      'GET /api/me': [200, makeMe()],
      'GET /api/notifications': [200, { items: [], unread: 0 }],
    });
    const { client } = renderApp('/me');
    await screen.findByRole('button', { name: /^Alerts/ });
    await waitFor(() => expect(client.getQueryData(inboxKey)).toBeDefined());
    const whatsNew = notice({ n: 1, feature: 'past-workouts' });
    act(() => client.setQueryData<Inbox>(inboxKey, { items: [whatsNew], unread: 1 }));
    const passed = {
      ...notice({ name: 'Maxo' }),
      id: 'n2',
      key: 'n_passed',
    };
    act(() => client.setQueryData<Inbox>(inboxKey, { items: [whatsNew, passed], unread: 2 }));
    expect(await screen.findByText('Maxo passed you on ATUS Climb. Go get it back.')).toBeVisible();
    expect(screen.queryByText(/New in GYMBROS/)).toBeNull();
  });

  it('opens from the bell', async () => {
    mockApi({
      'GET /api/me': [200, makeMe()],
      'GET /api/whats-new': [200, ENTRIES],
      'GET /api/notifications': [
        200,
        { items: [notice({ n: 1, feature: 'past-workouts' })], unread: 1 },
      ],
      'POST /api/notifications/read': [204, null],
    });
    renderApp('/me');
    await userEvent.click(await screen.findByRole('button', { name: /^Alerts/ }));
    const inbox = within(await screen.findByRole('dialog', { name: 'Alerts' }));
    await userEvent.click(inbox.getByRole('button', { name: /New in GYMBROS/ }));
    expect(await screen.findByRole('heading', { level: 1, name: 'What’s new' })).toBeVisible();
  });
});
