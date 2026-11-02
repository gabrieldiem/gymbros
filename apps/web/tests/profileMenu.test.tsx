import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { makeMe, mockApi, renderApp } from './renderApp';

const openMenu = async () => {
  await userEvent.click(await screen.findByRole('button', { name: /^Your profile/ }));
  return screen.findByRole('menu');
};

describe('Feedback', () => {
  it('sends what you wrote, and thanks you', async () => {
    const fetchMock = mockApi({
      'GET /api/me': [200, makeMe()],
      'POST /api/feedback': [201, null],
    });
    renderApp('/climb');
    const menu = within(await openMenu());
    await userEvent.click(menu.getByRole('menuitem', { name: 'Send feedback' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Send feedback' }));
    expect(sheet.getByRole('button', { name: 'Send' })).toBeDisabled();
    await userEvent.click(sheet.getByRole('button', { name: 'Bug' }));
    await userEvent.type(sheet.getByLabelText('What’s on your mind?'), 'The map is slow');
    await userEvent.click(sheet.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('Thanks. We got it.')).toBeVisible();
    const call = fetchMock.mock.calls.find(([url]) => url === '/api/feedback');
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ kind: 'bug', body: 'The map is slow' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

describe('Your data', () => {
  it('can be downloaded from settings', async () => {
    mockApi({ 'GET /api/me': [200, makeMe()] });
    renderApp('/climb');
    const menu = within(await openMenu());
    await userEvent.click(menu.getByRole('menuitem', { name: 'Profile and settings' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Profile and settings' }));
    const link = sheet.getByRole('link', { name: 'Download my data' });
    expect(link).toHaveAttribute('href', '/api/me/export');
    expect(link).toHaveAttribute('download');
  });
});

describe('Unsubscribing from an email', () => {
  it('asks first, because mail apps open links on their own', async () => {
    const fetchMock = mockApi({
      'GET /api/me': [401, { detail: { code: 'not_authenticated' } }],
      'POST /api/email/unsubscribe?u=u1&t=abc': [204, null],
    });
    renderApp('/unsubscribe?u=u1&t=abc');
    const stop = await screen.findByRole('button', { name: 'Stop them' });
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
    await userEvent.click(stop);
    expect(await screen.findByText(/You won’t get these emails any more/)).toBeVisible();
  });

  it('says so when the link is bad', async () => {
    mockApi({
      'GET /api/me': [401, { detail: { code: 'not_authenticated' } }],
      'POST /api/email/unsubscribe?u=u1&t=bad': [401, { detail: { code: 'not_authenticated' } }],
    });
    renderApp('/unsubscribe?u=u1&t=bad');
    await userEvent.click(await screen.findByRole('button', { name: 'Stop them' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/That link didn’t work/);
  });
});

describe('Your gyms in settings', () => {
  const openSettings = async () => {
    const menu = within(await openMenu());
    await userEvent.click(menu.getByRole('menuitem', { name: 'Profile and settings' }));
    return within(await screen.findByRole('dialog', { name: 'Profile and settings' }));
  };

  it('adds a gym and makes another the default', async () => {
    const fetchMock = mockApi({
      'GET /api/me': [200, makeMe()],
      'GET /api/me/gyms': [
        200,
        [
          { id: 'g1', name: 'Smart Fit', is_default: true },
          { id: 'g2', name: 'Home', is_default: false },
        ],
      ],
      'POST /api/me/gyms': [201, { id: 'g3', name: 'Club', is_default: false }],
      'PATCH /api/me/gyms/g2': [200, { id: 'g2', name: 'Home', is_default: true }],
      'DELETE /api/me/gyms/g1': [204, null],
    });
    renderApp('/climb');
    const sheet = await openSettings();
    await userEvent.click(await sheet.findByRole('radio', { name: 'Make Home your default' }));
    await userEvent.type(sheet.getByLabelText('Add a gym'), 'Club');
    await userEvent.click(sheet.getByRole('button', { name: 'Add' }));
    await userEvent.click(sheet.getByRole('button', { name: 'Remove Smart Fit' }));
    await waitFor(() => {
      const latest = fetchMock.mock.calls.map(
        ([url, init]) => `${init?.method ?? 'GET'} ${String(url)}`,
      );
      expect(latest).toContain('PATCH /api/me/gyms/g2');
      expect(latest).toContain('POST /api/me/gyms');
      expect(latest).toContain('DELETE /api/me/gyms/g1');
    });
  });
});

describe('Profile menu', () => {
  it('opens from the avatar and shows who you are', async () => {
    mockApi({ 'GET /api/me': [200, makeMe()] });
    renderApp('/climb');
    const menu = within(await openMenu());
    expect(menu.getByText('Gabi')).toBeVisible();
    expect(menu.getByText('gabi@example.com')).toBeVisible();
    expect(menu.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Your profile',
      'Achievements',
      'What’s new',
      'Profile and settings',
      'Send feedback',
      'Invite friends',
      'Log out',
    ]);
  });

  it('logs out from the menu', async () => {
    const fetchMock = mockApi({
      'GET /api/me': [200, makeMe()],
      'POST /api/auth/logout': [204, null],
    });
    renderApp('/climb');
    const menu = within(await openMenu());
    await userEvent.click(menu.getByRole('menuitem', { name: 'Log out' }));
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

  it('closes with Escape and returns focus to the avatar', async () => {
    mockApi({ 'GET /api/me': [200, makeMe()] });
    renderApp('/climb');
    await openMenu();
    expect(screen.getByRole('menuitem', { name: 'Your profile' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.getByRole('button', { name: /^Your profile/ })).toHaveFocus();
  });

  it('moves through items with the arrow keys and wraps', async () => {
    mockApi({ 'GET /api/me': [200, makeMe()] });
    renderApp('/climb');
    await openMenu();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Achievements' })).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}{ArrowUp}');
    expect(screen.getByRole('menuitem', { name: 'Log out' })).toHaveFocus();
  });

  it('closes when clicking elsewhere', async () => {
    mockApi({ 'GET /api/me': [200, makeMe()] });
    renderApp('/climb');
    await openMenu();
    await userEvent.click(document.body);
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  });

  it('links the privacy policy and terms from settings', async () => {
    mockApi({ 'GET /api/me': [200, makeMe()] });
    renderApp('/climb');
    const menu = within(await openMenu());
    await userEvent.click(menu.getByRole('menuitem', { name: 'Profile and settings' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Profile and settings' }));
    expect(dialog.getByRole('link', { name: 'Privacy policy' })).toHaveAttribute(
      'href',
      '/privacy',
    );
    expect(dialog.getByRole('link', { name: 'Terms of service' })).toHaveAttribute(
      'href',
      '/terms',
    );
  });

  it('opens Profile and settings, where you can rename yourself and pick a color', async () => {
    const fetchMock = mockApi({
      'GET /api/me': [200, makeMe()],
      'PATCH /api/me': (body) => [200, makeMe(body as object)],
    });
    renderApp('/climb');
    const menu = within(await openMenu());
    await userEvent.click(menu.getByRole('menuitem', { name: 'Profile and settings' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Profile and settings' }));
    const name = dialog.getByLabelText(/Your name/);
    expect(dialog.getByRole('button', { name: 'Save' })).toBeDisabled();
    await userEvent.clear(name);
    await userEvent.type(name, 'Gabo');
    await userEvent.click(dialog.getByRole('button', { name: 'Save' }));
    await dialog.findByDisplayValue('Gabo');
    await userEvent.click(dialog.getByRole('button', { name: 'Blue' }));
    const bodies = fetchMock.mock.calls
      .filter(([, init]) => init?.method === 'PATCH')
      .map(([, init]) => JSON.parse(String(init?.body)) as unknown);
    expect(bodies).toEqual([{ display_name: 'Gabo' }, { color: 'cyan' }]);
  });

  it('takes any two characters, counting an emoji as one', async () => {
    const fetchMock = mockApi({
      'GET /api/me': [200, makeMe()],
      'PATCH /api/me': (body) => [200, makeMe(body as object)],
    });
    renderApp('/climb');
    const menu = within(await openMenu());
    await userEvent.click(menu.getByRole('menuitem', { name: 'Profile and settings' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Profile and settings' }));
    const field = dialog.getByLabelText(/Your two characters/);
    fireEvent.change(field, { target: { value: '👨‍👩‍👧‍👦🔥💪' } });
    expect(field).toHaveValue('👨‍👩‍👧‍👦🔥');
    await userEvent.click(dialog.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH');
      expect(JSON.parse(String(call?.[1]?.body))).toEqual({ initials: '👨‍👩‍👧‍👦🔥' });
    });
  });

  it('offers a color picker for any color', async () => {
    const fetchMock = mockApi({
      'GET /api/me': [200, makeMe()],
      'PATCH /api/me': (body) => [200, makeMe(body as object)],
    });
    renderApp('/climb');
    const menu = within(await openMenu());
    await userEvent.click(menu.getByRole('menuitem', { name: 'Profile and settings' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Profile and settings' }));
    fireEvent.change(dialog.getByLabelText('Pick any color'), { target: { value: '#123456' } });
    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH');
      expect(JSON.parse(String(call?.[1]?.body))).toEqual({ color: '#123456' });
    });
  });

  it('shows an uploaded picture instead of your characters', async () => {
    mockApi({ 'GET /api/me': [200, makeMe({ avatar_url: '/api/avatars/u1?v=1' })] });
    renderApp('/climb');
    await screen.findByRole('button', { name: /^Your profile/ });
    const trigger = screen.getByRole('button', { name: /^Your profile/ });
    expect(trigger.querySelector('img')).toHaveAttribute('src', '/api/avatars/u1?v=1');
  });
});
