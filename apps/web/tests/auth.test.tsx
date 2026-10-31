import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { CREW, makeMe, mockApi, renderApp, SIGNED_OUT } from './renderApp';

async function fill(label: string, value: string) {
  await userEvent.type(screen.getByLabelText(label), value);
}

describe('Log in', () => {
  it('signs in and lands on ATUS Climb', async () => {
    mockApi({ 'GET /api/me': SIGNED_OUT, 'POST /api/auth/login': [200, makeMe()] });
    renderApp('/login');
    await screen.findByRole('heading', { name: 'Welcome back' });
    await fill('Email', 'gabi@example.com');
    await fill('Password', 'climbing-pw');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'ATUS Climb' })).toBeVisible();
  });

  it('shows the API error in the current language', async () => {
    mockApi({
      'GET /api/me': SIGNED_OUT,
      'POST /api/auth/login': [401, { detail: { code: 'invalid_credentials' } }],
    });
    renderApp('/login');
    await userEvent.click(await screen.findByRole('button', { name: 'ES' }));
    await fill('Email', 'gabi@example.com');
    await fill('Contraseña', 'wrong-pass');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El email y la contraseña no coinciden.',
    );
  });
});

describe('Register', () => {
  it('with an invite code: creates the account, then shows the crew welcome once', async () => {
    const fetchMock = mockApi({
      'GET /api/me': SIGNED_OUT,
      'POST /api/auth/register': [201, makeMe()],
    });
    renderApp('/register');
    await screen.findByRole('heading', { name: 'Create your account' });
    await fill('Name', 'Gabi');
    await fill('Email', 'gabi@example.com');
    await fill('Password', 'climbing-pw');
    await fill('Invite code', 'ironridge');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('heading', { name: 'This is Iron Ridge' })).toBeVisible();
    const call = fetchMock.mock.calls.find(([url]) => url === '/api/auth/register');
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      display_name: 'Gabi',
      email: 'gabi@example.com',
      password: 'climbing-pw',
      language: 'en',
      invite_code: 'ironridge',
    });

    await userEvent.click(screen.getByRole('button', { name: 'Let’s go' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'ATUS Climb' })).toBeVisible();
    expect(localStorage.getItem('gymbros.crewWelcome')).toBeNull();
  });

  it('without an invite code: goes to the join screen', async () => {
    const fetchMock = mockApi({
      'GET /api/me': SIGNED_OUT,
      'POST /api/auth/register': [201, makeMe({ crew: null })],
    });
    renderApp('/register');
    await screen.findByRole('heading', { name: 'Create your account' });
    await fill('Name', 'Gabi');
    await fill('Email', 'gabi@example.com');
    await fill('Password', 'climbing-pw');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByRole('heading', { name: 'Join your crew' })).toBeVisible();
    const call = fetchMock.mock.calls.find(([url]) => url === '/api/auth/register');
    expect(JSON.parse(String(call?.[1]?.body))).not.toHaveProperty('invite_code');
  });

  it('explains a taken email', async () => {
    mockApi({
      'GET /api/me': SIGNED_OUT,
      'POST /api/auth/register': [409, { detail: { code: 'email_taken' } }],
    });
    renderApp('/register');
    await screen.findByRole('heading', { name: 'Create your account' });
    await fill('Name', 'Gabi');
    await fill('Email', 'gabi@example.com');
    await fill('Password', 'climbing-pw');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('already an account');
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
      'POST /api/auth/logout': [204, null],
    });
    renderApp('/me');
    await userEvent.click(await screen.findByRole('button', { name: 'Log out' }));
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
