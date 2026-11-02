import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CREW, makeMe, mockApi, renderApp, SIGNED_OUT } from './renderApp';

const OPTIONS = [200, { google: true, dev_login: false }] as [number, unknown];

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
    expect(screen.getByRole('link', { name: 'Continue with Google' })).toBeVisible();
  });

  it('links to the repository and the legal pages in the footer', async () => {
    mockApi({ 'GET /api/me': SIGNED_OUT, 'GET /api/auth/options': OPTIONS });
    renderApp('/');
    const footer = within(await screen.findByRole('contentinfo'));
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
