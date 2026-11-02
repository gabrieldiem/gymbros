import type { Me } from '../../api/types';

/**
 * Who may see a route:
 * - guest: signed out (the landing page, login)
 * - join: signed in without a crew
 * - hello: signed in with a crew (the one-time crew welcome)
 * - member: signed in with a crew (the five tabs)
 * - admin: accounts in ADMIN_EMAILS, crew or not (the API enforces it; this only routes)
 */
export type Allow = 'guest' | 'join' | 'hello' | 'member' | 'admin';

/** Where to send the user instead, or null to render the route. */
export function gateRedirect(allow: Allow, me: Me | null, helloPending: boolean): string | null {
  if (allow === 'guest') return me ? (me.crew ? '/climb' : '/join') : null;
  if (!me) return '/';
  if (allow === 'admin') return me.is_admin ? null : '/climb';
  if (allow === 'join') return me.crew ? '/climb' : null;
  if (!me.crew) return '/join';
  if (allow === 'member' && helloPending) return '/hello';
  return null;
}
