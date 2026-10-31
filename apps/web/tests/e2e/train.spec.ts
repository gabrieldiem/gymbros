import { expect, test, type Page } from '@playwright/test';

// Needs `make up` and `make seed`. Logs a real workout for a demo member.
const DEMO_PASSWORD = 'climb-demo-2026';
const USERS: Record<string, string> = {
  mobile: 'jose@demo.gymbros.app',
  desktop: 'matex@demo.gymbros.app',
};
const SCREENS = 'test-results/screens';

async function logIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByRole('button', { name: 'EN' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/climb$/);
  await page.getByRole('button', { name: 'EN' }).click();
}

test('log a Push day and finish it', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await logIn(page, USERS[testInfo.project.name] ?? '');
  await page.goto('/train');

  // Leftover from an earlier failed run: throw it away.
  const discard = page.getByRole('button', { name: 'Discard', exact: true });
  if (await discard.isVisible({ timeout: 2000 }).catch(() => false)) {
    await discard.click();
    await page.getByRole('button', { name: 'Discard workout' }).click();
  }

  await expect(page.getByRole('heading', { level: 1, name: 'Start a workout' })).toBeVisible();
  await page.screenshot({
    path: `${SCREENS}/train-start-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: /Push day/ }).click();

  const bench = page.getByRole('article', { name: 'Bench press' });
  await expect(bench).toBeVisible();
  const load = bench.getByLabel('Bench press, set 1, kg');
  const reps = bench.getByLabel('Bench press, set 1, reps');
  if (!(await load.inputValue())) await load.fill('60');
  if (!(await reps.inputValue())) await reps.fill('5');
  await bench.getByRole('button', { name: 'Complete set 1' }).click();
  await expect(page.getByTestId('live-points')).not.toHaveText('0', { timeout: 5000 });
  await expect(page.getByRole('timer', { name: 'Rest' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    page.viewportSize()?.width,
  );
  await page.screenshot({ path: `${SCREENS}/train-logger-${testInfo.project.name}.png` });

  await page.getByRole('button', { name: 'Finish workout' }).click();
  const summary = page.getByRole('dialog');
  await expect(summary.getByText('Showed up')).toBeVisible();
  await page.waitForTimeout(1200); // let the count-up and line items settle for the screenshot
  await page.screenshot({ path: `${SCREENS}/train-finish-${testInfo.project.name}.png` });
  await summary.getByRole('button', { name: 'See ATUS Climb' }).click();
  await expect(page).toHaveURL(/\/climb$/);
  expect(errors).toEqual([]);
});
