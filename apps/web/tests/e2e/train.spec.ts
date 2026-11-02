import { expect, test } from '@playwright/test';
import { logIn } from './members';

// Run through `make e2e`. Logs a real workout for Jose in this project's e2e crew, which
// `make e2e` rebuilds before every run.
const SCREENS = 'test-results/screens';

test('log a Push day and finish it', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await logIn(page, 'jose', testInfo);
  await page.getByRole('button', { name: 'EN', exact: true }).click();
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
  const load = bench.getByLabel('Bench press, set 1, disks');
  const reps = bench.getByLabel('Bench press, set 1, reps');
  if (!(await load.inputValue())) await load.fill('60');
  if (!(await reps.inputValue())) await reps.fill('5');
  await bench.getByRole('button', { name: 'Complete set 1' }).click();
  await expect(page.getByTestId('live-points')).not.toHaveText('0', { timeout: 5000 });
  await expect(page.getByRole('timer', { name: 'Rest' })).toHaveCount(0);
  await page.getByRole('button', { name: /^Rest \d/ }).click();
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

test('log a swim: time and distance both pay', async ({ page }, testInfo) => {
  await logIn(page, 'santi', testInfo);
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await page.goto('/train');
  await page.getByRole('button', { name: /^Swim/ }).click();
  const swim = page.getByRole('article', { name: 'Pool swim' });
  await expect(swim).toBeVisible();
  await swim.getByLabel('Pool swim, set 1, min').fill('40');
  await swim.getByLabel('Pool swim, set 1, km').fill('1.5');
  await swim.getByRole('button', { name: 'Complete set 1' }).click();
  await expect(page.getByTestId('live-points')).not.toHaveText('0', { timeout: 5000 });
  await page.getByRole('button', { name: 'Finish workout' }).click();
  const summary = page.getByRole('dialog');
  await expect(summary.getByText('40 cardio minutes')).toBeVisible();
  await expect(summary.getByText('1.5 km covered')).toBeVisible();
  await expect(summary.getByText(/Full mile/)).toBeVisible();
  await page.screenshot({ path: `${SCREENS}/swim-finish-${testInfo.project.name}.png` });
  await summary.getByRole('button', { name: 'See ATUS Climb' }).click();
  await expect(page).toHaveURL(/\/climb$/);
});

test('log a workout you forgot, for a past day', async ({ page }, testInfo) => {
  await logIn(page, 'matex', testInfo);
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await page.goto('/train');
  await page.getByRole('button', { name: /Log a past workout/ }).click();
  const days = page.getByRole('dialog', { name: 'Which day was it?' });
  await page.waitForTimeout(400); // let the sheet settle for the screenshot
  await page.screenshot({ path: `${SCREENS}/past-days-${testInfo.project.name}.png` });
  await days.getByRole('button', { name: /^Yesterday/ }).click();
  await expect(page.getByText(/^Logging a workout for /)).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.waitForTimeout(400); // the sheet's exit copy is gone by now
  await page.screenshot({ path: `${SCREENS}/past-start-${testInfo.project.name}.png` });

  await page.getByRole('button', { name: /^Run/ }).click();
  const run = page.getByRole('article', { name: 'Outdoor run' });
  await run.getByLabel('Outdoor run, set 1, min').fill('30');
  await run.getByLabel('Outdoor run, set 1, km').fill('5');
  await run.getByRole('button', { name: 'Complete set 1' }).click();
  await expect(page.getByTestId('live-points')).not.toHaveText('0', { timeout: 5000 });
  await expect(page.getByRole('timer')).toHaveCount(0);
  await expect(page.getByText(/^For /)).toBeVisible();
  await page.screenshot({ path: `${SCREENS}/past-logger-${testInfo.project.name}.png` });

  await page.getByRole('button', { name: 'Finish workout' }).click();
  const summary = page.getByRole('dialog');
  await expect(summary.getByText(/logged for/)).toBeVisible();
  await summary.getByRole('button', { name: 'Done' }).click();

  await page.goto('/crew');
  const post = page.getByRole('listitem').filter({ hasText: 'Run' }).first();
  await expect(post.getByText(/^For /)).toBeVisible();
  await page.screenshot({ path: `${SCREENS}/past-feed-${testInfo.project.name}.png` });
});

test('stretching alone pays fixed points and leaves the week alone', async ({ page }, testInfo) => {
  await logIn(page, 'maxo', testInfo);
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await page.goto('/train');
  const pips = page.getByRole('img', { name: /workouts this week/ });
  await expect(pips).toBeVisible();
  const before = await pips.getAttribute('aria-label');
  await page.getByRole('button', { name: /^Stretching/ }).click();
  const card = page.getByRole('article', { name: 'Stretching' });
  await card.getByRole('button', { name: '10 min' }).click();
  await card.getByRole('button', { name: 'Complete set 1' }).click();
  await expect(page.getByTestId('live-points')).toHaveText('25', { timeout: 5000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SCREENS}/stretch-${testInfo.project.name}.png` });
  await page.getByRole('button', { name: 'Finish workout' }).click();
  const summary = page.getByRole('dialog');
  await expect(summary.getByText('Stretching', { exact: true }).last()).toBeVisible();
  await summary.getByRole('button', { name: 'Done' }).click();
  await expect(pips).toHaveAttribute('aria-label', before ?? '');
});
