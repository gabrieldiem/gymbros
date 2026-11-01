import { translate } from '../../i18n/translate';
import type { Language } from '../../i18n/translate';
import { CONTACT_EMAIL, type LegalContent } from './legalContent';

const LANGUAGES: Language[] = ['en', 'es'];

const STYLE = `body{margin:0;background:#0d0d0d;color:#f2f2ee;font:1rem/1.5 system-ui,sans-serif}
main{max-width:640px;margin:0 auto;padding:32px 18px}h1{line-height:1.1}h2{margin-bottom:4px}
hr{margin:40px 0;border:0;border-top:1px solid #2a2a2a}a{color:#f2f2ee}.updated{color:#8e8e8a}`;

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderLanguage(page: LegalContent, lang: Language): string {
  const text = (key: Parameters<typeof translate>[1]) =>
    escapeHtml(translate(lang, key, { email: CONTACT_EMAIL }));
  const sections = page.sections
    .map(({ heading, body }) => `<h2>${text(heading)}</h2><p>${text(body)}</p>`)
    .join('');
  return `<section lang="${lang}"><h1>${text(page.title)}</h1>
<p class="updated">${text('legal_updated')}</p><p>${text(page.intro)}</p>${sections}
<p><a href="/">${text('legal_back')}</a></p></section>`;
}

/**
 * The page as plain HTML in both languages, built next to the app. Google checks these links and
 * can't be relied on to run JavaScript; the app's own routes show the same copy to people in it.
 */
export function renderStaticLegalPage(page: LegalContent): string {
  const title = escapeHtml(translate('en', page.title));
  const body = LANGUAGES.map((lang) => renderLanguage(page, lang)).join('<hr>');
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${title} | GYMBROS</title>
<style>${STYLE}</style></head><body><main>${body}</main></body></html>`;
}
