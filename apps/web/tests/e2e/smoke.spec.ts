import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { memberEmail } from './members';

// Needs `make up`; run through `make e2e`, which rebuilds the e2e crews first.
const SCREENS = 'test-results/screens';

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    // The browser logs the expected 401 from /api/me while signed out.
    if (message.type() === 'error' && !message.text().includes('status of 401')) {
      errors.push(message.text());
    }
  });
  return errors;
}

async function expectNoSidewaysScroll(page: Page) {
  const width = page.viewportSize()?.width ?? 0;
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
}

async function shoot(page: Page, name: string, testInfo: TestInfo) {
  await page.screenshot({ path: `${SCREENS}/${name}-${testInfo.project.name}.png` });
}

test('signed out: welcome and login screens in both languages', async ({ page }, testInfo) => {
  const errors = collectErrors(page);
  await page.goto('/climb');
  await expect(page).toHaveURL(/\/welcome$/);
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Climb with your crew.' }),
  ).toBeVisible();
  await expectNoSidewaysScroll(page);
  await shoot(page, 'welcome-en', testInfo);

  await page.getByRole('button', { name: 'ES', exact: true }).click();
  await page.getByRole('link', { name: 'Acceso de desarrollo' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Hola de nuevo' })).toBeVisible();
  await shoot(page, 'login-es', testInfo);
  expect(errors).toEqual([]);
});

test('Google button: starts the sign-in in the chosen language', async ({ page }, testInfo) => {
  // The dev stack has no Google credentials unless they're in .env, so the server's answer is faked.
  await page.route('**/api/auth/options', (route) =>
    route.fulfill({ json: { google: true, dev_login: false } }),
  );
  await page.goto('/welcome');
  await page.getByRole('button', { name: 'ES', exact: true }).click();
  const button = page.getByRole('link', { name: 'Continuar con Google' });
  await expect(button).toHaveAttribute('href', '/api/auth/google/start?lang=es');
  const box = await button.boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(44);
  await expectNoSidewaysScroll(page);
  await shoot(page, 'welcome-google-es', testInfo);

  await page.goto('/login?auth_error=google');
  await expect(page.getByRole('alert')).toContainText('Google');
  await shoot(page, 'login-google-error', testInfo);
});

test('legal pages: public, in Spanish, nothing overflows', async ({ page }, testInfo) => {
  await page.goto('/welcome');
  await page.getByRole('button', { name: 'ES', exact: true }).click();
  await page.getByRole('link', { name: 'Política de privacidad' }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Política de privacidad' }),
  ).toBeVisible();
  await expectNoSidewaysScroll(page);
  await page.screenshot({
    path: `${SCREENS}/privacy-es-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.goto('/terms');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Términos del servicio' }),
  ).toBeVisible();
  await expectNoSidewaysScroll(page);
  await page.screenshot({
    path: `${SCREENS}/terms-es-${testInfo.project.name}.png`,
    fullPage: true,
  });
});

test('member: log in, see the tabs, language follows the profile, log out', async ({
  page,
}, testInfo) => {
  const errors = collectErrors(page);
  await page.goto('/login');
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await page.getByLabel('Email').fill(memberEmail('gabi', testInfo));
  await page.getByRole('button', { name: 'Log in' }).click();

  await expect(page).toHaveURL(/\/climb$/);
  // Normalise the profile language, whatever an earlier run left behind.
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Better than/ })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Rope order' }).getByRole('listitem')).toHaveCount(
    5,
  );
  await page.waitForTimeout(2800); // intro climb animation
  await expect(page.getByRole('status').filter({ hasText: 'Server online' })).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Main' });
  // Train's name also says "Training now" while a workout is in progress.
  for (const name of [/^ATUS Climb$/, /^Crew$/, /^Train\b/, /^Quests$/, /^You$/]) {
    await expect(nav.getByRole('link', { name })).toBeVisible();
  }
  await expect(page.getByRole('link', { name: /Your profile/ })).toBeVisible();
  await expectNoSidewaysScroll(page);
  await shoot(page, 'climb-en', testInfo);
  await page.screenshot({
    path: `${SCREENS}/climb-full-${testInfo.project.name}.png`,
    fullPage: true,
  });

  const profileSaved = page.waitForResponse(
    (r) => r.url().endsWith('/api/me') && r.request().method() === 'PATCH',
  );
  await page.getByRole('button', { name: 'ES', exact: true }).click();
  await profileSaved;
  await page
    .getByRole('navigation', { name: 'Principal' })
    .getByRole('link', { name: 'Equipo', exact: true })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Equipo' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Equipo' })).toBeVisible();
  await shoot(page, 'crew-es', testInfo);

  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await page.getByRole('link', { name: /Your profile/ }).click();
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/welcome$/);
  expect(errors).toEqual([]);
});
