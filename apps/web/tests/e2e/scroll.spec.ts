import { expect, test } from '@playwright/test';
import { logIn } from './members';

// Regression: <body> once became its own scroll container (overflow on html and body) with
// overscroll-behavior set, so the mouse wheel couldn't scroll the page on desktop.
test('the mouse wheel scrolls long pages', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'mouse wheel is a desktop input');
  // Maxo, shared with compete.spec.ts: both only read, and this spec doesn't care about language.
  await logIn(page, 'maxo', testInfo);
  for (const path of ['/me', '/crew']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // Wheel only once the data has loaded and the page is taller than the window.
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight))
      .toBeGreaterThan(600);
    await page.mouse.move(700, 450); // over the page content, not the rail
    await page.mouse.wheel(0, 600);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  }
});
