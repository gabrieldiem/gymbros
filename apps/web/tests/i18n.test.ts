import { describe, expect, it } from 'vitest';

import { en } from '../src/i18n/en';
import { es } from '../src/i18n/es';
import { detectLanguage, formatNumber, translate } from '../src/i18n/translate';

describe('i18n catalogs', () => {
  it('have exactly the same keys in English and Spanish', () => {
    expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort());
  });

  it('have no empty strings', () => {
    for (const catalog of [en, es]) {
      expect(Object.values(catalog).filter((value) => value.trim() === '')).toEqual([]);
    }
  });

  it('use the same placeholders in both languages', () => {
    const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(placeholders(es[key]), key).toEqual(placeholders(en[key]));
    }
  });
});

describe('translate', () => {
  it('returns the copy for the language', () => {
    expect(translate('en', 'nav_crew')).toBe('Crew');
    expect(translate('es', 'nav_crew')).toBe('Equipo');
  });

  it('keeps unknown placeholders visible', () => {
    expect(translate('en', 'tagline', { unused: 1 })).toBe('Better than yesterday.');
  });
});

describe('formatNumber', () => {
  it('uses the locale grouping separator', () => {
    expect(formatNumber('en', 3880)).toBe('3,880');
    expect(formatNumber('es', 3880)).toBe('3.880');
  });
});

describe('detectLanguage', () => {
  it.each([
    ['es-AR', 'es'],
    ['es', 'es'],
    ['en-US', 'en'],
    ['de-DE', 'en'],
    [undefined, 'en'],
  ] as const)('%s → %s', (browser, expected) => {
    expect(detectLanguage(browser)).toBe(expected);
  });
});
