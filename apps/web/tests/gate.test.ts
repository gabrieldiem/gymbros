import { describe, expect, it } from 'vitest';

import { gateRedirect, type Allow } from '../src/features/auth/gate';
import { makeMe } from './renderApp';

const member = makeMe();
const noCrew = makeMe({ crew: null });

describe('gateRedirect', () => {
  it.each<[Allow, ReturnType<typeof makeMe> | null, boolean, string | null]>([
    ['guest', null, false, null],
    ['guest', member, false, '/climb'],
    ['guest', noCrew, false, '/join'],
    ['join', null, false, '/welcome'],
    ['join', noCrew, false, null],
    ['join', member, false, '/climb'],
    ['hello', null, false, '/welcome'],
    ['hello', noCrew, false, '/join'],
    ['hello', member, true, null],
    ['member', null, false, '/welcome'],
    ['member', noCrew, false, '/join'],
    ['member', member, false, null],
    ['member', member, true, '/hello'],
  ])('%s with %o (hello pending: %s) → %s', (allow, me, pending, expected) => {
    expect(gateRedirect(allow, me, pending)).toBe(expected);
  });
});
