import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { BADGE_ICON_NAMES } from '../src/components/badgeIcons';
import { en } from '../src/i18n/en';
import { es } from '../src/i18n/es';

type BadgeDef = { id: string; icon: string; elite?: boolean };

const badges = (
  JSON.parse(readFileSync(resolve(__dirname, '../../api/src/resources/badges.json'), 'utf-8')) as {
    badges: BadgeDef[];
  }
).badges;

describe('Achievements copy', () => {
  it('names and describes every badge the API has, in both languages', () => {
    expect(badges.length).toBeGreaterThan(0);
    for (const { id } of badges) {
      for (const catalog of [en, es] as Record<string, string>[]) {
        expect(catalog[`badge_${id}`], `badge_${id}`).toBeTruthy();
        expect(catalog[`badge_${id}_d`], `badge_${id}_d`).toBeTruthy();
      }
    }
  });

  it('has a drawn icon for every badge', () => {
    for (const { id, icon } of badges) expect(BADGE_ICON_NAMES, id).toContain(icon);
  });
});
