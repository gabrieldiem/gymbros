import { expect, test } from '@playwright/test';

const SCREENS = 'test-results/screens';

test.describe('shell smoke', () => {
  test('loads ATUS Climb, reaches the API and switches language', async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });

    await page.goto('/');
    await expect(page).toHaveURL(/\/climb$/);
    await expect(page.getByRole('heading', { level: 1, name: 'ATUS Climb' })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Server online' })).toBeVisible();

    const nav = page.getByRole('navigation', { name: 'Main' });
    for (const name of ['ATUS Climb', 'Crew', 'Train', 'Quests', 'You']) {
      await expect(nav.getByRole('link', { name, exact: true })).toBeVisible();
    }

    const width = page.viewportSize()?.width ?? 0;
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await page.screenshot({ path: `${SCREENS}/climb-en-${testInfo.project.name}.png` });

    await page.getByRole('button', { name: 'ES' }).click();
    const navEs = page.getByRole('navigation', { name: 'Principal' });
    await navEs.getByRole('link', { name: 'Equipo', exact: true }).click();
    await expect(page).toHaveURL(/\/crew$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Equipo' })).toBeVisible();
    await page.screenshot({ path: `${SCREENS}/crew-es-${testInfo.project.name}.png` });

    expect(errors).toEqual([]);
  });

  test('serves the SPA on deep links', async ({ page }) => {
    await page.goto('/quests');
    await expect(page.getByRole('heading', { level: 1, name: 'Quests' })).toBeVisible();
  });
});
