import { describe, expect, it } from 'vitest';

import { timeAgo } from '../src/i18n/timeAgo';

const NOW = Date.parse('2026-11-05T12:00:00Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe('timeAgo', () => {
  it('says just now under a minute', () => {
    expect(timeAgo('en', ago(30_000), NOW)).toBe('just now');
    expect(timeAgo('es', ago(30_000), NOW)).toBe('ahora mismo');
  });

  it('uses minutes, hours and days', () => {
    expect(timeAgo('en', ago(5 * 60_000), NOW)).toBe('5 minutes ago');
    expect(timeAgo('en', ago(2 * 3_600_000), NOW)).toBe('2 hours ago');
    expect(timeAgo('en', ago(86_400_000), NOW)).toBe('yesterday');
    expect(timeAgo('es', ago(3 * 86_400_000), NOW)).toBe('hace 3 días');
  });
});
