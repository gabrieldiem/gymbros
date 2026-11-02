import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CREW, makeMe, mockApi, renderApp, SIGNED_OUT } from './renderApp';

const INVITE = {
  'GET /api/crews/invite/IRONRIDGE': [200, { crew_name: 'Iron Ridge', members: 4 }],
};
const NOT_FOUND = [404, { detail: { code: 'invite_code_not_found' } }];

describe('Invite links', () => {
  beforeEach(() => localStorage.clear());

  it('shows the crew to someone signed out and remembers the code', async () => {
    mockApi({
      'GET /api/me': SIGNED_OUT,
      'GET /api/auth/options': [200, { google: true, dev_login: false }],
      ...INVITE,
    } as never);
    renderApp('/invite/IRONRIDGE');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'You’re invited to Iron Ridge' }),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Continue with Google' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Privacy policy' })).toBeVisible();
    expect(localStorage.getItem('gymbros.invite')).toBe('IRONRIDGE');
  });

  it('explains a code that no longer works', async () => {
    mockApi({
      'GET /api/me': SIGNED_OUT,
      'GET /api/crews/invite/OLDCODE1': NOT_FOUND,
    } as never);
    renderApp('/invite/OLDCODE1');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'This invite doesn’t work' }),
    ).toBeVisible();
  });

  it('fills in the join screen after signing in, and forgets the code once joined', async () => {
    localStorage.setItem('gymbros.invite', 'IRONRIDGE');
    const fetchMock = mockApi({
      'GET /api/me': [200, makeMe({ crew: null })],
      'POST /api/crews/join': [200, makeMe({ crew: CREW })],
    });
    renderApp('/join');
    expect(await screen.findByLabelText('Invite code')).toHaveValue('IRONRIDGE');
    await userEvent.click(screen.getByRole('button', { name: 'Join crew' }));
    expect(await screen.findByRole('heading', { name: 'This is Iron Ridge' })).toBeVisible();
    const call = fetchMock.mock.calls.find(([url]) => url === '/api/crews/join');
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ invite_code: 'IRONRIDGE' });
    expect(localStorage.getItem('gymbros.invite')).toBeNull();
  });

  it('sends a member with a crew straight to the app', async () => {
    mockApi({ 'GET /api/me': [200, makeMe()], ...INVITE } as never);
    renderApp('/invite/IRONRIDGE');
    expect(await screen.findByRole('heading', { level: 1, name: /Better than/ })).toBeVisible();
  });

  it('sends someone without a crew to the filled-in join screen', async () => {
    mockApi({ 'GET /api/me': [200, makeMe({ crew: null })], ...INVITE } as never);
    renderApp('/invite/IRONRIDGE');
    expect(await screen.findByLabelText('Invite code')).toHaveValue('IRONRIDGE');
  });

  it('copies the link from the profile menu when the phone has no share sheet', async () => {
    const user = userEvent.setup();
    mockApi({ 'GET /api/me': [200, makeMe()] });
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    renderApp('/climb');
    await user.click(await screen.findByRole('button', { name: /^Your profile/ }));
    await user.click(screen.getByRole('menuitem', { name: 'Invite friends' }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/invite/IRONRIDGE`),
    );
    expect(await screen.findByText('Invite link copied')).toBeVisible();
  });

  it('uses the share sheet when there is one', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    mockApi({ 'GET /api/me': [200, makeMe()] });
    renderApp('/climb');
    await userEvent.click(await screen.findByRole('button', { name: /^Your profile/ }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Invite friends' }));
    await waitFor(() => expect(share).toHaveBeenCalledOnce());
    expect(share.mock.calls[0]?.[0]).toMatchObject({
      url: `${window.location.origin}/invite/IRONRIDGE`,
    });
    Reflect.deleteProperty(navigator, 'share');
  });
});
