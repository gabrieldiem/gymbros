import { describe, expect, it } from 'vitest';

import { PRIVACY_PAGE, TERMS_PAGE } from '../src/features/legal/legalContent';
import { renderStaticLegalPage } from '../src/features/legal/staticLegalPage';
import { translate } from '../src/i18n/translate';

const PRIVACY = renderStaticLegalPage(PRIVACY_PAGE);
const TERMS = renderStaticLegalPage(TERMS_PAGE);

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

  // What Google's OAuth verification looks for: support.google.com/cloud/answer/13806988
  it.each([
    ['what Google data is accessed', '<h2>Google user data we access</h2>'],
    ['the scopes', 'openid, email and profile'],
    ['how it is used', '<h2>How we use your data</h2>'],
    ['who it is shared with', '<h2>Who we share it with</h2>'],
    ['how it is protected', '<h2>How we protect your data</h2>'],
    ['encryption', 'encrypted with HTTPS'],
    ['retention and deletion', '<h2>How long we keep it, and how to delete it</h2>'],
    ['how to delete', 'choose Delete account'],
    ['the Limited Use statement', 'including the Limited Use requirements'],
    ['no AI training', 'develop, improve or train AI or machine learning models'],
    ['who is responsible', 'whoever runs a copy of it is responsible'],
    ['server logs', 'including your IP address'],
    ['workout photos and gyms', 'where they are if you put them on the map, a photo of a workout'],
    ['the map provider', 'OpenStreetMap (receives what you search for'],
    ['steps, and that the crew sees them', 'the steps you log'],
    ['who sees steps', 'workouts, steps,'],
    ['what a picture loses', 'removes their metadata'],
    ['the weekly digest and how to stop it', 'a weekly digest of your week'],
    ['what Resend receives', 'what’s in each email'],
    ['what stays on the phone', 'So the app works with no signal'],
    ['the download', 'download all your training'],
  ])('discloses %s', (_what, text) => {
    expect(PRIVACY).toContain(text);
  });

  it('has the same disclosures in Spanish', () => {
    expect(PRIVACY).toContain('<h2>Cómo protegemos tus datos</h2>');
    expect(PRIVACY).toContain('incluidos los requisitos de uso limitado');
  });

  it('is honest about what deleting an account leaves behind', () => {
    expect(PRIVACY).toContain('What can remain');
  });

  it('gives a way to reach us', () => {
    expect(PRIVACY).toContain('hello@example.test');
  });
});

describe('Who runs it', () => {
  it('never names a person, because anyone can run a copy', () => {
    for (const page of [PRIVACY, TERMS]) {
      expect(page).not.toMatch(/Gabriel|Diem|gabrieldiem/);
    }
  });

  it('says who is responsible anyway', () => {
    expect(PRIVACY).toContain('whoever runs a copy of it is responsible');
    expect(TERMS).toContain('whoever runs this copy');
  });
});
