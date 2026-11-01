import { expect, test } from '@playwright/test';
import { E2E_PASSWORD, memberEmail } from './members';

// Run through `make e2e`, which rebuilds the e2e crews first.
const SCREENS = 'test-results/screens';

test('quests, badges, recap and the You tab', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/login');
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await page.getByLabel('Email').fill(memberEmail('maxo', testInfo));
  await page.getByLabel('Password').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/climb$/);
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  const width = page.viewportSize()?.width;

  await page.goto('/quests');
  await expect(page.getByRole('region', { name: /Crew climbs/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  await page.screenshot({ path: `${SCREENS}/quests-${testInfo.project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Badges', exact: true }).click();
  await expect(page.getByText(/Each one pays out once/)).toBeVisible();
  await page.screenshot({ path: `${SCREENS}/badges-${testInfo.project.name}.png`, fullPage: true });

  await page.goto('/climb');
  await page.getByRole('button', { name: /Last week/ }).click();
  await expect(page.getByRole('dialog', { name: 'Weekly recap' })).toBeVisible();
  await page.screenshot({ path: `${SCREENS}/recap-${testInfo.project.name}.png` });
  await page.keyboard.press('Escape');

  await page.goto('/me');
  await expect(page.getByRole('img', { name: 'Weekly tonnage' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  await page.screenshot({ path: `${SCREENS}/me-${testInfo.project.name}.png`, fullPage: true });
  expect(errors).toEqual([]);
});
