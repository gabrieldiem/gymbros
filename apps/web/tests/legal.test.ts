import { describe, expect, it } from 'vitest';

import { PRIVACY_PAGE, TERMS_PAGE } from '../src/features/legal/legalContent';
import { renderStaticLegalPage } from '../src/features/legal/staticLegalPage';
import { translate } from '../src/i18n/translate';

const PRIVACY = renderStaticLegalPage(PRIVACY_PAGE);

describe('static legal pages', () => {
  it.each([
    ['privacy', PRIVACY_PAGE],
    ['terms', TERMS_PAGE],
  ])('%s has every section in both languages', (_name, page) => {
    const html = renderStaticLegalPage(page);
    for (const lang of ['en', 'es'] as const) {
      for (const { heading } of page.sections) {
        expect(html).toContain(`<h2>${translate(lang, heading)}</h2>`);
      }
    }
    expect(html).not.toContain('{email}');
    expect(html).not.toContain('<script');
  });

  it('says how Google user data is accessed, used, stored and shared', () => {
    expect(PRIVACY).toContain('<h2>Google user data</h2>');
    expect(PRIVACY).toContain('accesses your name, email address and Google account ID');
    expect(PRIVACY).toContain('We use them only to');
    expect(PRIVACY).toContain('We store them');
    expect(PRIVACY).toContain('We don’t share them with anyone else');
  });

  it('gives a way to reach us', () => {
    expect(PRIVACY).toContain('hola@contact.gabrieldiem.com');
  });
});
