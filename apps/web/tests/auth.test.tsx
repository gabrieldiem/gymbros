import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { STATS } from './competeFixtures';
import { CREW, makeMe, mockApi, renderApp, SIGNED_OUT } from './renderApp';

async function fill(label: string, value: string) {
  await userEvent.type(screen.getByLabelText(label), value);
}

const GOOGLE_ONLY = [200, { google: true, dev_login: false }] as const;
const WITH_DEV_LOGIN = [200, { google: false, dev_login: true }] as const;

describe('Signing in', () => {
  it('offers Google on the welcome screen, in the current language', async () => {
    mockApi({ 'GET /api/me': SIGNED_OUT, 'GET /api/auth/options': [...GOOGLE_ONLY] });
    renderApp('/welcome');
    const link = await screen.findByRole('link', { name: 'Continue with Google' });
    expect(link).toHaveAttribute('href', '/api/auth/google/start?lang=en');
    await userEvent.click(screen.getByRole('button', { name: 'ES' }));
    expect(await screen.findByRole('link', { name: 'Continuar con Google' })).toHaveAttribute(
      'href',
      '/api/auth/google/start?lang=es',
    );
    expect(screen.queryByRole('link', { name: 'Dev login' })).toBeNull();
  });

  it('never asks for a password', async () => {
    mockApi({ 'GET /api/me': SIGNED_OUT, 'GET /api/auth/options': [...WITH_DEV_LOGIN] });
    renderApp('/login');
    await screen.findByLabelText('Email');
    expect(screen.queryByLabelText('Password')).toBeNull();
  });

  it('explains when Google sign-in failed', async () => {
    mockApi({ 'GET /api/me': SIGNED_OUT, 'GET /api/auth/options': [...GOOGLE_ONLY] });
    renderApp('/login?auth_error=google');
    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t sign in with Google');
    expect(screen.getByRole('link', { name: 'Continue with Google' })).toBeVisible();
  });

  it('shows no error on a normal visit', async () => {
    mockApi({ 'GET /api/me': SIGNED_OUT, 'GET /api/auth/options': [...GOOGLE_ONLY] });
    renderApp('/login');
    await screen.findByRole('link', { name: 'Continue with Google' });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('hides the Google button when the server has no credentials', async () => {
    mockApi({ 'GET /api/me': SIGNED_OUT, 'GET /api/auth/options': [...WITH_DEV_LOGIN] });
    renderApp('/welcome');
    await screen.findByRole('link', { name: 'Dev login' });
    expect(screen.queryByRole('link', { name: 'Continue with Google' })).toBeNull();
  });

  it('sends old register links to the welcome screen', async () => {
    mockApi({ 'GET /api/me': SIGNED_OUT, 'GET /api/auth/options': [...GOOGLE_ONLY] });
    renderApp('/register');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Climb with your crew.' }),
    ).toBeVisible();
  });
});

describe('Dev login', () => {
  it('is hidden unless the server offers it', async () => {
    mockApi({ 'GET /api/me': SIGNED_OUT, 'GET /api/auth/options': [...GOOGLE_ONLY] });
    renderApp('/login');
    await screen.findByRole('link', { name: 'Continue with Google' });
    expect(screen.queryByLabelText('Email')).toBeNull();
  });

  it('signs in with an email and lands on ATUS Climb', async () => {
    const fetchMock = mockApi({
      'GET /api/me': SIGNED_OUT,
      'GET /api/auth/options': [...WITH_DEV_LOGIN],
      'POST /api/auth/dev-login': [200, makeMe()],
    });
    renderApp('/login');
    await screen.findByLabelText('Email');
    await fill('Email', 'gabi@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByRole('heading', { level: 1, name: /Better than/ })).toBeVisible();
    const call = fetchMock.mock.calls.find(([url]) => url === '/api/auth/dev-login');
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      email: 'gabi@example.com',
      language: 'en',
    });
  });

  it('without a crew: goes to the join screen, then the crew welcome once', async () => {
    mockApi({
      'GET /api/me': SIGNED_OUT,
      'GET /api/auth/options': [...WITH_DEV_LOGIN],
      'POST /api/auth/dev-login': [200, makeMe({ crew: null })],
      'POST /api/crews/join': [200, makeMe()],
    });
    renderApp('/login');
    await screen.findByLabelText('Email');
    await fill('Email', 'gabi@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    await screen.findByRole('heading', { name: 'Join your crew' });
    await fill('Invite code', 'IRONRIDGE');
    await userEvent.click(screen.getByRole('button', { name: 'Join crew' }));
    expect(await screen.findByRole('heading', { name: 'This is Iron Ridge' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Let’s go' }));
    expect(await screen.findByRole('heading', { level: 1, name: /Better than/ })).toBeVisible();
    expect(localStorage.getItem('gymbros.crewWelcome')).toBeNull();
  });
});

describe('Join a crew', () => {
  it('rejects an unknown code, then joins with the right one', async () => {
    mockApi({
      'GET /api/me': [200, makeMe({ crew: null })],
      'POST /api/crews/join': (body) =>
        (body as { invite_code: string }).invite_code === 'IRONRIDGE'
          ? [200, makeMe({ crew: CREW })]
          : [404, { detail: { code: 'invite_code_not_found' } }],
    });
    renderApp('/join');
    await screen.findByRole('heading', { name: 'Join your crew' });
    await fill('Invite code', 'NOPE1234');
    await userEvent.click(screen.getByRole('button', { name: 'Join crew' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No crew has that invite code');

    await userEvent.clear(screen.getByLabelText('Invite code'));
    await fill('Invite code', 'IRONRIDGE');
    await userEvent.click(screen.getByRole('button', { name: 'Join crew' }));
    expect(await screen.findByRole('heading', { name: 'This is Iron Ridge' })).toBeVisible();
  });
});

describe('Log out', () => {
  it('returns to the welcome screen', async () => {
    const fetchMock = mockApi({
      'GET /api/me': [200, makeMe()],
      'GET /api/me/stats': [200, STATS],
      'POST /api/auth/logout': [204, null],
    });
    renderApp('/me');
    await userEvent.click(await screen.findByRole('button', { name: 'Settings' }));
    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Climb with your crew.' }),
    ).toBeVisible();
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/auth/logout',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
  });
});

describe('Legal pages', () => {
  it.each([
    ['/privacy', 'Privacy policy', 'What we collect'],
    ['/terms', 'Terms of service', 'Train safely'],
  ])('%s is public, with the contact address where it applies', async (path, title, section) => {
    mockApi({ 'GET /api/me': SIGNED_OUT });
    renderApp(path);
    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeVisible();
    expect(screen.getByRole('heading', { level: 2, name: section })).toBeVisible();
    expect(document.body.textContent).toContain('hola@contact.gabrieldiem.com');
    expect(document.body.textContent).not.toContain('{email}');
  });

  it('stays readable for a signed-in member', async () => {
    mockApi({ 'GET /api/me': [200, makeMe()] });
    renderApp('/privacy');
    expect(await screen.findByRole('heading', { level: 1, name: 'Privacy policy' })).toBeVisible();
  });

  it('follows the chosen language', async () => {
    mockApi({ 'GET /api/me': SIGNED_OUT });
    renderApp('/terms');
    await userEvent.click(await screen.findByRole('button', { name: 'ES' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Términos del servicio' }),
    ).toBeVisible();
  });

  it('is linked from the welcome and login screens', async () => {
    mockApi({ 'GET /api/me': SIGNED_OUT, 'GET /api/auth/options': [...GOOGLE_ONLY] });
    renderApp('/welcome');
    expect(await screen.findByRole('link', { name: 'Privacy policy' })).toHaveAttribute(
      'href',
      '/privacy',
    );
    expect(screen.getByRole('link', { name: 'Terms of service' })).toHaveAttribute(
      'href',
      '/terms',
    );
  });
});
