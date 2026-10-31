import { expect, test } from '@playwright/test';

// Regression: <body> once became its own scroll container (overflow on html and body) with
// overscroll-behavior set, so the mouse wheel couldn't scroll the page on desktop.
test('the mouse wheel scrolls long pages', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'mouse wheel is a desktop input');
  await page.goto('/login');
  // Maxo: a member no other spec changes (language, workouts) while this one runs.
  await page.getByLabel('Email').fill('maxo@demo.gymbros.app');
  await page.getByLabel('Password').fill('climb-demo-2026');
  await page.getByRole('button', { name: /Log in|Entrar/ }).click();
  await expect(page).toHaveURL(/\/climb$/);
  for (const path of ['/me', '/crew']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.mouse.move(700, 450); // over the page content, not the rail
    await page.mouse.wheel(0, 600);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  }
});
