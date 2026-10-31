import type { Me } from '../../api/types';

/**
 * Who may see a route:
 * - guest: signed out (welcome, login, register)
 * - join: signed in without a crew
 * - hello: signed in with a crew (the one-time crew welcome)
 * - member: signed in with a crew (the five tabs)
 */
export type Allow = 'guest' | 'join' | 'hello' | 'member';

/** Where to send the user instead, or null to render the route. */
export function gateRedirect(allow: Allow, me: Me | null, helloPending: boolean): string | null {
  if (allow === 'guest') return me ? (me.crew ? '/climb' : '/join') : null;
  if (!me) return '/welcome';
  if (allow === 'join') return me.crew ? '/climb' : null;
  if (!me.crew) return '/join';
  if (allow === 'member' && helloPending) return '/hello';
  return null;
}
