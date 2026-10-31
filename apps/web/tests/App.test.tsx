import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { mockFetchJson, renderApp } from './renderApp';

describe('App shell', () => {
  it('redirects / to ATUS Climb', async () => {
    mockFetchJson(200, { status: 'running', database: 'up' });
    renderApp('/');
    expect(await screen.findByRole('heading', { level: 1, name: 'ATUS Climb' })).toBeVisible();
  });

  it('shows the five tabs with Train in the middle', () => {
    mockFetchJson(200, { status: 'running', database: 'up' });
    renderApp('/climb');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const tabs = within(nav)
      .getAllByRole('link')
      .filter((link) => !link.hasAttribute('aria-label'))
      .map((link) => link.textContent);
    expect(tabs).toEqual(['ATUS Climb', 'Crew', 'Train', 'Quests', 'You']);
  });

  it('marks the current tab', () => {
    mockFetchJson(200, { status: 'running', database: 'up' });
    renderApp('/quests');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Quests' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('switches the language from the top bar and remembers it', async () => {
    mockFetchJson(200, { status: 'running', database: 'up' });
    renderApp('/crew');
    await userEvent.click(screen.getByRole('button', { name: 'ES' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Equipo' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'ES' })).toHaveAttribute('aria-pressed', 'true');
    expect(localStorage.getItem('gymbros.lang')).toBe('es');
    expect(document.documentElement.lang).toBe('es');
  });

  it('shows a not-found page for unknown paths', () => {
    mockFetchJson(200, { status: 'running', database: 'up' });
    renderApp('/nope');
    expect(screen.getByRole('heading', { level: 1, name: 'Off the trail' })).toBeVisible();
  });
});

describe('HealthStatus', () => {
  it('shows online when the API and database are up', async () => {
    const fetchMock = mockFetchJson(200, { status: 'running', database: 'up' });
    renderApp('/climb');
    expect(await screen.findByText('Server online')).toBeVisible();
    expect(fetchMock).toHaveBeenCalledWith('/api/health', expect.anything());
  });

  it('shows offline when the API reports the database down', async () => {
    mockFetchJson(503, { status: 'degraded', database: 'down' });
    renderApp('/climb');
    expect(await screen.findByText('Server offline. Retrying.')).toBeVisible();
  });

  it('shows offline when the request fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    renderApp('/climb');
    expect(await screen.findByText('Server offline. Retrying.')).toBeVisible();
  });
});
