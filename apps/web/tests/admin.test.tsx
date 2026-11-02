import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { CREW, makeMe, mockApi, renderApp, SIGNED_OUT } from './renderApp';

const ADMIN = makeMe({ is_admin: true });
const OVERVIEW = {
  users: 12,
  crews: 2,
  users_without_crew: 1,
  workouts: 340,
  recent_workouts: 21,
  recent_active_users: 9,
  recent_points: 4100,
};
const CREW_ROW = { ...CREW, members: 5, points: 21000 };
const MAXO = {
  id: 'u2',
  email: 'maxo@example.com',
  display_name: 'Maxo',
  initials: 'MX',
  color: 'red',
  crew_name: 'Iron Ridge',
  points: 4510,
  workouts: 88,
  last_workout_at: null,
  created_at: '2026-10-01T10:00:00Z',
  is_admin: false,
};
const ROUTES = {
  'GET /api/me': [200, ADMIN] as [number, unknown],
  'GET /api/admin/overview': [200, OVERVIEW] as [number, unknown],
  'GET /api/admin/crews': [200, [CREW_ROW]] as [number, unknown],
  'GET /api/admin/members': [200, [MAXO]] as [number, unknown],
  'GET /api/admin/actions': [200, []] as [number, unknown],
};

const openView = async (name: string) => {
  await userEvent.click(await screen.findByRole('button', { name }));
};

describe('Backoffice access', () => {
  it('sends regular members back to the app', async () => {
    mockApi({ 'GET /api/me': [200, makeMe()] });
    renderApp('/admin');
    expect(await screen.findByRole('heading', { level: 1, name: /Better than/ })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Backoffice' })).toBeNull();
  });

  it('sends signed-out visitors to the landing page', async () => {
    mockApi({ 'GET /api/me': SIGNED_OUT });
    renderApp('/admin');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Climb with your crew.' }),
    ).toBeVisible();
  });

  it('opens for an admin without a crew', async () => {
    mockApi({ ...ROUTES, 'GET /api/me': [200, makeMe({ is_admin: true, crew: null })] });
    renderApp('/admin');
    expect(await screen.findByRole('heading', { level: 1, name: 'Backoffice' })).toBeVisible();
  });

  it('is only in the profile menu for admins', async () => {
    mockApi({ 'GET /api/me': [200, makeMe()] });
    const { unmount } = renderApp('/climb');
    await userEvent.click(await screen.findByRole('button', { name: /^Your profile/ }));
    expect(screen.queryByRole('menuitem', { name: 'Backoffice' })).toBeNull();
    unmount();
    mockApi({ 'GET /api/me': [200, ADMIN] });
    renderApp('/climb');
    await userEvent.click(await screen.findByRole('button', { name: /^Your profile/ }));
    expect(screen.getByRole('menuitem', { name: 'Backoffice' })).toHaveAttribute('href', '/admin');
  });
});

describe('Backoffice', () => {
  it('shows the overview', async () => {
    mockApi(ROUTES);
    renderApp('/admin');
    expect(await screen.findByText('Workouts, last 7 days')).toBeVisible();
    await waitFor(() => expect(screen.getByText('340')).toBeVisible(), { timeout: 4000 });
  });

  it('creates a crew', async () => {
    const fetchMock = mockApi({
      ...ROUTES,
      'POST /api/admin/crews': [201, { ...CREW_ROW, id: 'c2', name: 'ATUS' }],
    });
    renderApp('/admin');
    await openView('Crews');
    await userEvent.click(await screen.findByRole('button', { name: 'New crew' }));
    const dialog = within(await screen.findByRole('dialog'));
    await userEvent.type(dialog.getByLabelText('Crew name'), 'ATUS');
    await userEvent.click(dialog.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const call = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      name: 'ATUS',
      time_zone: 'America/Argentina/Buenos_Aires',
    });
  });

  it('asks twice before replacing an invite code', async () => {
    const fetchMock = mockApi({
      ...ROUTES,
      'POST /api/admin/crews/c1/invite-code': [200, { ...CREW_ROW, invite_code: 'NEWCODE1' }],
    });
    renderApp('/admin');
    await openView('Crews');
    await userEvent.click(await screen.findByRole('button', { name: /Iron Ridge/ }));
    const dialog = within(await screen.findByRole('dialog'));
    await userEvent.click(dialog.getByRole('button', { name: 'Replace the invite code' }));
    const sent = () =>
      fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/invite-code')).length;
    expect(sent()).toBe(0);
    await userEvent.click(dialog.getByRole('button', { name: 'Yes, replace it' }));
    await waitFor(() => expect(sent()).toBe(1));
  });

  it('adjusts points, needing an amount and a reason', async () => {
    const fetchMock = mockApi({ ...ROUTES, 'POST /api/admin/members/u2/points': [204, null] });
    renderApp('/admin');
    await openView('Accounts');
    await userEvent.click(await screen.findByRole('button', { name: /Maxo/ }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Maxo' }));
    const submit = dialog.getByRole('button', { name: 'Adjust points' });
    expect(submit).toBeDisabled();
    await userEvent.type(dialog.getByLabelText(/^Points/), '-200');
    await userEvent.type(dialog.getByLabelText('Reason'), 'Typo fix');
    await userEvent.click(submit);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/points'));
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ points: -200, reason: 'Typo fix' });
  });

  it('only deletes an account after its email is typed', async () => {
    const fetchMock = mockApi({ ...ROUTES, 'DELETE /api/admin/members/u2': [204, null] });
    renderApp('/admin');
    await openView('Accounts');
    await userEvent.click(await screen.findByRole('button', { name: /Maxo/ }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Maxo' }));
    const remove = dialog.getByRole('button', { name: 'Delete account' });
    expect(remove).toBeDisabled();
    await userEvent.type(dialog.getByLabelText(/Type maxo@example.com/), 'maxo@example');
    expect(remove).toBeDisabled();
    await userEvent.type(dialog.getByLabelText(/Type maxo@example.com/), '.com');
    await userEvent.click(remove);
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/members/u2',
        expect.objectContaining({ method: 'DELETE' }),
      ),
    );
  });

  it('shows the audit log', async () => {
    mockApi({
      ...ROUTES,
      'GET /api/admin/actions': [
        200,
        [
          {
            id: 'a1',
            admin_email: 'boss@example.com',
            action: 'points_adjusted',
            target: 'u2',
            details: { points: 300, reason: 'Logged on paper' },
            created_at: new Date().toISOString(),
          },
        ],
      ],
    });
    renderApp('/admin');
    await openView('Log');
    expect(await screen.findByText('Points adjusted')).toBeVisible();
    expect(screen.getByText('300, Logged on paper')).toBeVisible();
  });
});

describe('Deleting your own account', () => {
  it('needs your email, then signs you out', async () => {
    const fetchMock = mockApi({
      'GET /api/me': [200, makeMe()],
      'POST /api/me/delete': [204, null],
    });
    renderApp('/climb');
    await userEvent.click(await screen.findByRole('button', { name: /^Your profile/ }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Settings' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Settings' }));
    await userEvent.click(dialog.getByText('Delete account', { selector: 'summary' }));
    const remove = dialog.getByRole('button', { name: 'Delete account' });
    expect(remove).toBeDisabled();
    await userEvent.type(dialog.getByLabelText(/Type gabi@example.com/), 'gabi@example.com');
    await userEvent.click(remove);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Climb with your crew.' }),
    ).toBeVisible();
    const call = fetchMock.mock.calls.find(([url]) => url === '/api/me/delete');
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ confirm_email: 'gabi@example.com' });
  });
});
