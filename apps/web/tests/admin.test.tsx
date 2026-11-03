import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { AdminCrew } from '../src/api/admin';
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
const CREW_ROW: AdminCrew = {
  ...CREW,
  invite_uses: 3,
  invite_max_uses: null,
  invite_expires_at: null,
  invite_status: 'active',
  members: 5,
  points: 21000,
};
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

vi.mock('../src/features/admin/RichTextEditor', () => ({
  default: ({
    value,
    onChange,
    label,
  }: {
    value: string;
    onChange: (v: string) => void;
    label: string;
  }) => <textarea aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />,
}));

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

  it('takes an admin without a crew to the backoffice, not the invite screen', async () => {
    mockApi({ ...ROUTES, 'GET /api/me': [200, makeMe({ is_admin: true, crew: null })] });
    renderApp('/climb');
    expect(await screen.findByRole('heading', { level: 1, name: 'Backoffice' })).toBeVisible();
    expect(screen.queryByLabelText('Invite code')).toBeNull();
    expect(screen.getByRole('link', { name: 'Join a crew' })).toHaveAttribute('href', '/join');
    expect(screen.getByRole('button', { name: 'Log out' })).toBeVisible();
  });

  it('lands there from the landing page too', async () => {
    mockApi({ ...ROUTES, 'GET /api/me': [200, makeMe({ is_admin: true, crew: null })] });
    renderApp('/');
    expect(await screen.findByRole('heading', { level: 1, name: 'Backoffice' })).toBeVisible();
  });

  it('lets that admin still open the join screen, with a way back', async () => {
    mockApi({ 'GET /api/me': [200, makeMe({ is_admin: true, crew: null })] });
    renderApp('/join');
    expect(await screen.findByLabelText('Invite code')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Backoffice' })).toHaveAttribute('href', '/admin');
  });

  it('still asks a regular member without a crew for a code', async () => {
    mockApi({ 'GET /api/me': [200, makeMe({ crew: null })] });
    renderApp('/climb');
    expect(await screen.findByLabelText('Invite code')).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Backoffice' })).toBeNull();
  });

  it('keeps the way back to the app for an admin in a crew', async () => {
    mockApi(ROUTES);
    renderApp('/admin');
    expect(await screen.findByRole('link', { name: 'Back to the app' })).toBeVisible();
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
    await userEvent.click(screen.getByRole('menuitem', { name: 'Profile and settings' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Profile and settings' }));
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

describe('Invite codes in the backoffice', () => {
  const openCrew = async (row = CREW_ROW, extra = {}) => {
    const fetchMock = mockApi({
      ...ROUTES,
      'GET /api/admin/crews': [200, [row]],
      ...extra,
    });
    renderApp('/admin');
    await openView('Crews');
    await userEvent.click(await screen.findByRole('button', { name: new RegExp(row.name) }));
    return { fetchMock, dialog: within(await screen.findByRole('dialog')) };
  };
  const patchBody = (fetchMock: ReturnType<typeof mockApi>) =>
    JSON.parse(
      String(fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH')?.[1]?.body),
    ) as unknown;

  it('sets a custom code and limits, sending only what changed', async () => {
    const { fetchMock, dialog } = await openCrew(CREW_ROW, {
      'PATCH /api/admin/crews/c1': [200, CREW_ROW],
    });
    await userEvent.clear(dialog.getByLabelText(/^Code/));
    await userEvent.type(dialog.getByLabelText(/^Code/), 'ATUS2026');
    await userEvent.type(dialog.getByLabelText(/^Maximum uses/), '10');
    await userEvent.click(dialog.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(patchBody(fetchMock)).toEqual({ invite_code: 'ATUS2026', invite_max_uses: 10 });
  });

  it('sets an expiry as an absolute time', async () => {
    const { fetchMock, dialog } = await openCrew(CREW_ROW, {
      'PATCH /api/admin/crews/c1': [200, CREW_ROW],
    });
    await userEvent.type(dialog.getByLabelText(/^Expires/), '2030-05-01T18:30');
    await userEvent.click(dialog.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(patchBody(fetchMock)).toEqual({
      invite_expires_at: new Date('2030-05-01T18:30').toISOString(),
    });
  });

  it('clearing a limit sends null, and an old expiry does not block a rename', async () => {
    const expired: AdminCrew = {
      ...CREW_ROW,
      invite_max_uses: 3,
      invite_expires_at: '2020-01-01T10:00:00Z',
      invite_status: 'expired',
    };
    const { fetchMock, dialog } = await openCrew(expired, {
      'PATCH /api/admin/crews/c1': [200, expired],
    });
    await userEvent.clear(dialog.getByLabelText(/^Maximum uses/));
    await userEvent.type(dialog.getByLabelText('Crew name'), '!');
    await userEvent.click(dialog.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(patchBody(fetchMock)).toEqual({ name: 'Iron Ridge!', invite_max_uses: null });
  });

  it('shows a taken code as an error and stays open', async () => {
    const { dialog } = await openCrew(CREW_ROW, {
      'PATCH /api/admin/crews/c1': [409, { detail: { code: 'invite_code_taken' } }],
    });
    await userEvent.clear(dialog.getByLabelText(/^Code/));
    await userEvent.type(dialog.getByLabelText(/^Code/), 'TAKEN1');
    await userEvent.click(dialog.getByRole('button', { name: 'Save' }));
    expect(await dialog.findByRole('alert')).toHaveTextContent('Another crew already uses');
  });

  it('shows how much of the code is used', async () => {
    const { dialog } = await openCrew({ ...CREW_ROW, invite_max_uses: 10 });
    expect(dialog.getByText(/Used 3 of 10 times/)).toBeVisible();
  });

  it('marks a dead code in the list and offers no email for it', async () => {
    const used: AdminCrew = { ...CREW_ROW, invite_max_uses: 3, invite_status: 'used_up' };
    const { dialog } = await openCrew(used);
    expect(screen.getAllByText('Used up').length).toBeGreaterThan(0);
    expect(dialog.queryByRole('button', { name: 'Send invite' })).toBeNull();
  });

  it('emails an invite and confirms it', async () => {
    const { fetchMock, dialog } = await openCrew(CREW_ROW, {
      'POST /api/admin/crews/c1/invites': [
        200,
        { sent: true, link: 'https://x/invite/IRONRIDGE', existing_account: false },
      ],
    });
    await userEvent.type(dialog.getByLabelText('Email'), 'new@friend.com');
    await userEvent.click(dialog.getByRole('button', { name: 'Send invite' }));
    expect(await screen.findByText('Invite sent to new@friend.com')).toBeVisible();
    const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/invites'));
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      email: 'new@friend.com',
      language: 'en',
    });
  });

  it('offers the link to copy when the email could not go out', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    const { dialog } = await openCrew(CREW_ROW, {
      'POST /api/admin/crews/c1/invites': [
        200,
        { sent: false, link: 'https://x/invite/IRONRIDGE', existing_account: false },
      ],
    });
    await userEvent.type(dialog.getByLabelText('Email'), 'new@friend.com');
    await userEvent.click(dialog.getByRole('button', { name: 'Send invite' }));
    expect(await dialog.findByRole('alert')).toHaveTextContent('couldn’t be sent');
    await user.click(within(dialog.getByRole('alert')).getByRole('button'));
    expect(writeText).toHaveBeenCalledWith('https://x/invite/IRONRIDGE');
  });

  it('explains why someone can’t be invited', async () => {
    const { dialog } = await openCrew(CREW_ROW, {
      'POST /api/admin/crews/c1/invites': [409, { detail: { code: 'member_in_other_crew' } }],
    });
    await userEvent.type(dialog.getByLabelText('Email'), 'busy@friend.com');
    await userEvent.click(dialog.getByRole('button', { name: 'Send invite' }));
    expect(await dialog.findByRole('alert')).toHaveTextContent('in another crew');
  });
});

describe('Backoffice: feedback', () => {
  const ITEM = {
    id: 'f1',
    kind: 'bug',
    body: 'The map is slow',
    created_at: new Date().toISOString(),
    handled: false,
    display_name: 'Maxo',
    email: 'maxo@example.com',
  };

  it('shows what members sent and marks it as handled', async () => {
    const fetchMock = mockApi({
      'GET /api/me': [200, makeMe({ is_admin: true })],
      'GET /api/admin/overview': [200, OVERVIEW],
      'GET /api/admin/feedback': [200, [ITEM]],
      'PATCH /api/admin/feedback/f1': [200, { handled: true }],
    });
    renderApp('/admin');
    await userEvent.click(await screen.findByRole('button', { name: 'Feedback' }));
    expect(await screen.findByText('The map is slow')).toBeVisible();
    expect(screen.getByRole('link', { name: 'maxo@example.com' })).toHaveAttribute(
      'href',
      'mailto:maxo@example.com',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Mark as handled' }));
    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        ([url, init]) => url === '/api/admin/feedback/f1' && init?.method === 'PATCH',
      );
      expect(JSON.parse(String(call?.[1]?.body))).toEqual({ handled: true });
    });
  });

  it('says so when there is nothing yet', async () => {
    mockApi({
      'GET /api/me': [200, makeMe({ is_admin: true })],
      'GET /api/admin/overview': [200, OVERVIEW],
      'GET /api/admin/feedback': [200, []],
    });
    renderApp('/admin');
    await userEvent.click(await screen.findByRole('button', { name: 'Feedback' }));
    expect(await screen.findByText(/What members send from the app/)).toBeVisible();
  });
});

describe('Backoffice: email', () => {
  const SETTINGS = {
    welcome_enabled: true,
    digest_enabled: false,
    digest_hour: 9,
    configured: true,
    sender: 'GYMBROS <hola@example.com>',
    digests_sent_this_week: 0,
  };
  const bodies = (fetchMock: ReturnType<typeof mockApi>, url: string) =>
    fetchMock.mock.calls
      .filter(([u, init]) => u === url && init?.method !== undefined && init.method !== 'GET')
      .map(([, init]) => JSON.parse(String(init?.body)) as unknown);
  const openEmail = async (routes: Parameters<typeof mockApi>[0] = {}) => {
    const fetchMock = mockApi({
      'GET /api/me': [200, ADMIN],
      'GET /api/admin/overview': [200, OVERVIEW],
      'GET /api/admin/crews': [200, [CREW_ROW]],
      'GET /api/admin/email': [200, SETTINGS],
      ...routes,
    });
    renderApp('/admin');
    await userEvent.click(await screen.findByRole('button', { name: 'Email' }));
    await screen.findByRole('heading', { name: 'Automatic emails' });
    return fetchMock;
  };

  it('turns on the digest, which starts off', async () => {
    const fetchMock = await openEmail({
      'PATCH /api/admin/email': [200, { ...SETTINGS, digest_enabled: true }],
    });
    const digest = screen.getByRole('checkbox', { name: 'Weekly digest on Monday morning' });
    expect(digest).not.toBeChecked();
    await userEvent.click(digest);
    await waitFor(() =>
      expect(bodies(fetchMock, '/api/admin/email')).toEqual([{ digest_enabled: true }]),
    );
  });

  it('says plainly when email can’t go out at all', async () => {
    await openEmail({ 'GET /api/admin/email': [200, { ...SETTINGS, configured: false }] });
    expect(screen.getByText(/RESEND_API_KEY isn’t set/)).toBeVisible();
  });

  it('asks before sending, saying how many it reaches', async () => {
    const fetchMock = await openEmail({
      'POST /api/admin/email/message': (body) =>
        (body as { dry_run?: boolean }).dry_run
          ? [200, { recipients: 5, sent: 0 }]
          : [200, { recipients: 5, sent: 5 }],
    });
    await userEvent.type(screen.getByLabelText('Subject'), 'Gym closed');
    await userEvent.type(await screen.findByLabelText('Message'), 'See you Monday');
    await userEvent.click(screen.getByRole('button', { name: 'Review' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Send to 5' }));
    expect(await screen.findByText('Sent to 5 of 5.')).toBeVisible();
    expect(bodies(fetchMock, '/api/admin/email/message')).toEqual([
      { subject: 'Gym closed', html: 'See you Monday', full_document: false, dry_run: true },
      { subject: 'Gym closed', html: 'See you Monday', full_document: false },
    ]);
  });

  it('counts again if the message changes after reviewing', async () => {
    await openEmail({ 'POST /api/admin/email/message': [200, { recipients: 5, sent: 0 }] });
    await userEvent.type(screen.getByLabelText('Subject'), 'Gym closed');
    await userEvent.type(await screen.findByLabelText('Message'), 'See you');
    await userEvent.click(screen.getByRole('button', { name: 'Review' }));
    await screen.findByRole('button', { name: 'Send to 5' });
    await userEvent.selectOptions(screen.getByLabelText('To'), 'One person');
    expect(screen.queryByRole('button', { name: 'Send to 5' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Review' })).toBeDisabled();
  });

  const TEMPLATES = [
    { id: 'announcement', subject: 'News', html: '<html>Announcing {{name}}</html>', live: false },
    { id: 'welcome', subject: 'Welcome', html: '<html>Hi {{name}}</html>', live: true },
    { id: 'digest', subject: 'Your week', html: '<html>+640</html>', live: true },
    { id: 'invite', subject: 'Invited', html: '<html>Join</html>', live: false },
  ];
  const withTemplates = {
    'GET /api/admin/email/templates?language=en': [200, TEMPLATES],
    'POST /api/admin/email/preview': [200, { html: '<p>Rendered</p>' }],
    'POST /api/admin/email/message': (body: unknown) =>
      (body as { dry_run?: boolean }).dry_run
        ? [200, { recipients: 5, sent: 0 }]
        : [200, { recipients: 5, sent: 5 }],
  } as Parameters<typeof openEmail>[0];

  it('offers every email GYMBROS sends to start from', async () => {
    await openEmail(withTemplates);
    for (const name of [
      /^Blank/,
      /^Announcement/,
      /^Welcome email/,
      /^Weekly digest/,
      /^Crew invitation/,
    ]) {
      expect(screen.getByRole('radio', { name })).toBeVisible();
    }
  });

  it('starts from a template as HTML, sent whole, with no editor to flatten it', async () => {
    const fetchMock = await openEmail(withTemplates);
    await userEvent.click(screen.getByRole('radio', { name: /^Announcement/ }));
    expect(await screen.findByLabelText('HTML')).toHaveValue('<html>Announcing {{name}}</html>');
    expect(screen.getByLabelText('Subject')).toHaveValue('News');
    expect(screen.getByRole('button', { name: 'HTML' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Write' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Review' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Send to 5' }));
    await screen.findByText('Sent to 5 of 5.');
    expect(bodies(fetchMock, '/api/admin/email/message')[1]).toEqual({
      subject: 'News',
      html: '<html>Announcing {{name}}</html>',
      full_document: true,
    });
  });

  it('sends a live template as each person’s own, previewed in a page with no scripts', async () => {
    const fetchMock = await openEmail(withTemplates);
    await userEvent.click(screen.getByRole('radio', { name: /^Welcome email/ }));
    const preview = await screen.findByTitle('Preview of the email');
    expect(preview).toHaveAttribute('sandbox', '');
    expect(screen.queryByLabelText('Subject')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Review' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Send to 5' }));
    await screen.findByText('Sent to 5 of 5.');
    expect(bodies(fetchMock, '/api/admin/email/message')[1]).toEqual({ template: 'welcome' });
  });

  it('warns that a copy of the digest has example numbers', async () => {
    await openEmail(withTemplates);
    await userEvent.click(screen.getByRole('radio', { name: /^Weekly digest/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Edit a copy instead' }));
    expect(await screen.findByText(/example numbers, and they go out as written/)).toBeVisible();
    expect(screen.getByLabelText('HTML')).toHaveValue('<html>+640</html>');
  });

  it('won’t send an empty message', async () => {
    await openEmail(withTemplates);
    await userEvent.type(screen.getByLabelText('Subject'), 'Gym closed');
    await userEvent.type(await screen.findByLabelText('Message'), '<p> </p>');
    expect(screen.getByRole('button', { name: 'Review' })).toBeDisabled();
  });

  it('can’t send to nobody', async () => {
    await openEmail({ 'POST /api/admin/email/message': [200, { recipients: 0, sent: 0 }] });
    await userEvent.type(screen.getByLabelText('Subject'), 'Gym closed');
    await userEvent.type(await screen.findByLabelText('Message'), 'See you');
    await userEvent.click(screen.getByRole('button', { name: 'Review' }));
    expect(await screen.findByText('Nobody would get this.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Send to 0' })).toBeDisabled();
  });
});
