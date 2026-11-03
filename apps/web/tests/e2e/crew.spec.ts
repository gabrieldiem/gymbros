import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';
import { logIn, memberEmail } from './members';

// Run through `make e2e` (the e2e crews are seeded with the last 10 days of workouts).
const SCREENS = 'test-results/screens';

test('crew feed, a reaction, hall of fame and the inbox', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/login');
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await page.getByLabel('Email').fill(memberEmail('santi', testInfo));
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/climb$/);
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    page.viewportSize()?.width,
  );

  await page.goto('/crew');
  await expect(page.getByRole('heading', { level: 1, name: 'Crew' })).toBeVisible();
  // The oldest post on screen: other specs post to this crew in parallel, on top of the feed.
  const fist = page.getByRole('button', { name: /^Fist bump, \d+$/ }).last();
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

test('react with any emoji from the real picker, and answer with a picture', async ({
  page,
}, testInfo) => {
  await logIn(page, 'santi', testInfo, 'offline');
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await page.goto('/crew');
  const post = page
    .locator('main li')
    .filter({ has: page.getByRole('button', { name: /^Fist bump/ }) })
    .last();
  await post.getByRole('button', { name: 'Add a reaction' }).first().click();
  const sheet = page.getByRole('dialog', { name: 'Pick an emoji' });
  // Served by this site: nothing goes to a CDN.
  const outside: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('jsdelivr')) outside.push(r.url());
  });
  await sheet.getByRole('searchbox').fill('rocket');
  await sheet.getByRole('gridcell', { name: /^rocket$/i }).click();
  await expect(sheet).toHaveCount(0);
  const rocket = post.getByRole('button', { name: /^🚀, \d+$/ });
  await expect(rocket).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: `${SCREENS}/emoji-${testInfo.project.name}.png` });
  await rocket.click(); // put it back
  await expect(post.getByRole('button', { name: /^🚀/ })).toHaveCount(0);
  expect(outside).toEqual([]);

  await post.getByRole('button', { name: /comments?|comentarios?/i }).click();
  await post.locator('input[type="file"]').setInputFiles({
    name: 'my-holiday-in-paris.png',
    mimeType: 'image/png',
    buffer: readFileSync('public/icon-192.png'),
  });
  const image = post.getByRole('img', { name: /from Santi/ }).last();
  await expect(image).toBeVisible();
  const src = await image.getAttribute('src');
  expect(src).not.toContain('paris');
  const served = await page.request.get(src ?? '');
  expect(served.headers()['content-disposition']).toMatch(/gymbros-[0-9a-f]+\./);
  expect(served.headers()['content-disposition']).not.toContain('paris');
});
