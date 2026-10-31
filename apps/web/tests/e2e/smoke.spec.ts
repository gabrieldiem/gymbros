import { expect, test, type Page, type TestInfo } from '@playwright/test';

// Needs the dev stack and the demo crew: `make up` then `make seed`.
const SCREENS = 'test-results/screens';
const DEMO_PASSWORD = 'climb-demo-2026';
// One demo member per project, so parallel projects never change the same profile.
const USERS: Record<string, string> = {
  mobile: 'gabi@demo.gymbros.app',
  desktop: 'santi@demo.gymbros.app',
};

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

test('signed out: welcome, register and login screens in both languages', async ({
  page,
}, testInfo) => {
  const errors = collectErrors(page);
  await page.goto('/climb');
  await expect(page).toHaveURL(/\/welcome$/);
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Climb with your crew.' }),
  ).toBeVisible();
  await expectNoSidewaysScroll(page);
  await shoot(page, 'welcome-en', testInfo);

  await page.getByRole('link', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Create your account' })).toBeVisible();
  await expectNoSidewaysScroll(page);
  await shoot(page, 'register-en', testInfo);

  await page.getByRole('button', { name: 'ES', exact: true }).click();
  await page.getByRole('link', { name: 'Ya tengo cuenta' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Hola de nuevo' })).toBeVisible();
  await shoot(page, 'login-es', testInfo);
  expect(errors).toEqual([]);
});

test('member: log in, see the tabs, language follows the profile, log out', async ({
  page,
}, testInfo) => {
  const errors = collectErrors(page);
  await page.goto('/login');
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await page.getByLabel('Email').fill(USERS[testInfo.project.name] ?? '');
  await page.getByLabel('Password').fill(DEMO_PASSWORD);
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
  for (const name of ['ATUS Climb', 'Crew', 'Train', 'Quests', 'You']) {
    await expect(nav.getByRole('link', { name, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('link', { name: 'Your profile' })).toBeVisible();
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
  await page.getByRole('link', { name: 'Your profile' }).click();
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/welcome$/);
  expect(errors).toEqual([]);
});
