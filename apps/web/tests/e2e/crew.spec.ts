import { expect, test } from '@playwright/test';
import { E2E_PASSWORD, memberEmail } from './members';

// Run through `make e2e` (the e2e crews are seeded with the last 10 days of workouts).
const SCREENS = 'test-results/screens';

test('crew feed, a reaction, hall of fame and the inbox', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/login');
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await page.getByLabel('Email').fill(memberEmail('santi', testInfo));
  await page.getByLabel('Password').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/climb$/);
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    page.viewportSize()?.width,
  );

  await page.goto('/crew');
  await expect(page.getByRole('heading', { level: 1, name: 'Crew' })).toBeVisible();
  const fist = page.getByRole('button', { name: /^Fist bump, \d+$/ }).first();
  await expect(fist).toBeVisible();
  const before = await fist.getAttribute('aria-pressed');
  await fist.click();
  await expect(fist).not.toHaveAttribute('aria-pressed', before ?? 'false');
  await fist.click(); // put it back
  await expect(fist).toHaveAttribute('aria-pressed', before ?? 'false');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    page.viewportSize()?.width,
  );
  await page.screenshot({ path: `${SCREENS}/crew-feed-${testInfo.project.name}.png` });

  await page.getByRole('button', { name: 'Hall of fame' }).click();
  await expect(page.getByRole('region', { name: 'Crew records' })).toBeVisible();
  await page.screenshot({
    path: `${SCREENS}/crew-hof-${testInfo.project.name}.png`,
    fullPage: true,
  });

  await page.getByRole('button', { name: /^Alerts/ }).click();
  await expect(page.getByRole('dialog', { name: 'Alerts' })).toBeVisible();
  await page.screenshot({ path: `${SCREENS}/inbox-${testInfo.project.name}.png` });
  expect(errors).toEqual([]);
});
