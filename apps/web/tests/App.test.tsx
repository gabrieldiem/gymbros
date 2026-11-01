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
    expect(tabs).toEqual(['ATUS Climb', 'Crew', 'Train', 'Quests', 'You']);
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

  it('shows the avatar with initials linking to the profile', async () => {
    mockApi({ 'GET /api/me': [200, makeMe({ initials: 'GD' })] });
    renderApp('/climb');
    const link = await screen.findByRole('link', { name: /Your profile/ });
    expect(link).toHaveAttribute('href', '/me');
    expect(link).toHaveTextContent('GD');
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
    expect(screen.getByRole('link', { name: 'Continue with Google' })).toHaveAttribute(
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
