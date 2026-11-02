import type { Me } from '../../api/types';

/**
 * Who may see a route:
 * - guest: signed out (the landing page, login)
 * - join: signed in without a crew
 * - hello: signed in with a crew (the one-time crew welcome)
 * - member: signed in with a crew (the five tabs)
 * - admin: accounts in ADMIN_EMAILS, crew or not (the API enforces it; this only routes)
 *
 * An admin doesn't need a crew, so one without a crew lands on the backoffice instead of being
 * asked for an invite code. They can still open the join screen themselves.
 */
export type Allow = 'guest' | 'join' | 'hello' | 'member' | 'admin';

const withoutCrew = (me: Me) => (me.is_admin ? '/admin' : '/join');

/** Where to send the user instead, or null to render the route. */
export function gateRedirect(allow: Allow, me: Me | null, helloPending: boolean): string | null {
  if (allow === 'guest') return me ? (me.crew ? '/climb' : withoutCrew(me)) : null;
  if (!me) return '/';
  if (allow === 'admin') return me.is_admin ? null : '/climb';
  if (allow === 'join') return me.crew ? '/climb' : null;
  if (!me.crew) return withoutCrew(me);
  if (allow === 'member' && helloPending) return '/hello';
  return null;
}
