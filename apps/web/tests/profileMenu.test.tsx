import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { makeMe, mockApi, renderApp } from './renderApp';

const openMenu = async () => {
  await userEvent.click(await screen.findByRole('button', { name: /^Your profile/ }));
  return screen.findByRole('menu');
};

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
      'Points',
      'Settings',
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
    await userEvent.click(menu.getByRole('menuitem', { name: 'Settings' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Settings' }));
    expect(dialog.getByRole('link', { name: 'Privacy policy' })).toHaveAttribute(
      'href',
      '/privacy',
    );
    expect(dialog.getByRole('link', { name: 'Terms of service' })).toHaveAttribute(
      'href',
      '/terms',
    );
  });

  it('opens settings, where you can rename yourself and pick a color', async () => {
    const fetchMock = mockApi({
      'GET /api/me': [200, makeMe()],
      'PATCH /api/me': (body) => [200, makeMe(body as object)],
    });
    renderApp('/climb');
    const menu = within(await openMenu());
    await userEvent.click(menu.getByRole('menuitem', { name: 'Settings' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Settings' }));
    const name = dialog.getByLabelText('Your name');
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
});
