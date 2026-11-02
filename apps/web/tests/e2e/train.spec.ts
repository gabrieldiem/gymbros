import { expect, test } from '@playwright/test';
import { logIn } from './members';

// Run through `make e2e`. Logs a real workout for Jose in this project's e2e crew, which
// `make e2e` rebuilds before every run.
const SCREENS = 'test-results/screens';

test('log a Push day and finish it', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await logIn(page, 'jose', testInfo, 'train');
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
  await logIn(page, 'santi', testInfo, 'train');
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await page.goto('/train');
  await page.getByRole('button', { name: /^Swim/ }).click();
  const swim = page.getByRole('article', { name: 'Pool swim' });
  await expect(swim).toBeVisible();
  await swim.getByLabel('Pool swim, set 1, min').fill('40');
  await swim.getByLabel('Pool swim, set 1, km').fill('1.5');
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
  await logIn(page, 'matex', testInfo, 'train');
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
  await expect(page.getByTestId('live-points')).not.toHaveText('0', { timeout: 5000 });
  await expect(page.getByRole('timer')).toHaveCount(0);
  await expect(page.getByText(/^For /)).toBeVisible();
  await page.screenshot({ path: `${SCREENS}/past-logger-${testInfo.project.name}.png` });

  await page.getByRole('button', { name: 'Finish workout' }).click();
  const summary = page.getByRole('dialog');
  await expect(summary.getByText(/logged for/)).toBeVisible();
  await summary.getByRole('button', { name: 'Done' }).click();

  await page.goto('/crew');
  await expect(page.getByText(/^For /).first()).toBeVisible();
  await page.screenshot({ path: `${SCREENS}/past-feed-${testInfo.project.name}.png` });
});

test('stretching alone pays fixed points and leaves the week alone', async ({ page }, testInfo) => {
  await logIn(page, 'maxo', testInfo, 'train');
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await page.goto('/train');
  const pips = page.getByRole('img', { name: /workouts this week/ });
  await expect(pips).toBeVisible();
  const before = await pips.getAttribute('aria-label');
  await page.getByRole('button', { name: /^Stretching/ }).click();
  const card = page.getByRole('article', { name: 'Stretching' });
  await card.getByRole('button', { name: '10 min' }).click();
  await expect(page.getByTestId('live-points')).toHaveText('25', { timeout: 5000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SCREENS}/stretch-${testInfo.project.name}.png` });
  await page.getByRole('button', { name: 'Finish workout' }).click();
  const summary = page.getByRole('dialog');
  await expect(summary.getByText('Stretching', { exact: true }).last()).toBeVisible();
  await summary.getByRole('button', { name: 'Done' }).click();
  await expect(pips).toHaveAttribute('aria-label', before ?? '');
});

test('add a gym photo and your crew sees it on the post', async ({ page }, testInfo) => {
  await logIn(page, 'gabi', testInfo, 'train');
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await page.goto('/train');
  await page.getByRole('button', { name: /^Run/ }).click();
  const run = page.getByRole('article', { name: 'Outdoor run' });
  await run.getByLabel('Outdoor run, set 1, min').fill('20');

  // A large picture: the app has to shrink it below the server's limit.
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 3000;
    canvas.height = 2000;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('no canvas');
    for (let x = 0; x < 3000; x += 10) {
      context.fillStyle = `hsl(${x % 360} 80% 50%)`;
      context.fillRect(x, 0, 10, 2000);
    }
    return canvas.toDataURL('image/png').split(',')[1] ?? '';
  });
  await page
    .getByRole('button', { name: 'Add a gym photo' })
    .locator('xpath=ancestor::div[2]')
    .locator('input[type=file]')
    .setInputFiles({ name: 'gym.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  const photo = page.getByRole('img', { name: 'Your gym photo' });
  await expect(photo).toBeVisible({ timeout: 10000 });
  await expect
    .poll(() => photo.evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBe(1280);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SCREENS}/photo-logger-${testInfo.project.name}.png` });

  await page.getByRole('button', { name: 'Finish workout' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Done' }).click();
  await page.goto('/crew');
  const posted = page.getByRole('img', { name: /^Gym photo from / }).first();
  await expect(posted).toBeVisible();
  await page.screenshot({ path: `${SCREENS}/photo-feed-${testInfo.project.name}.png` });
});

test('a whole workout with no signal sends itself when the signal is back', async ({
  page,
  context,
}, testInfo) => {
  await logIn(page, 'gabi', testInfo, 'offline');
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await page.goto('/train');
  await expect(page.getByRole('button', { name: /^Cardio/ })).toBeVisible();
  await page.waitForLoadState('networkidle');

  await context.setOffline(true);
  await page.getByRole('button', { name: /^Cardio/ }).click();
  const treadmill = page.getByRole('article', { name: 'Treadmill run' });
  await expect(treadmill).toBeVisible();
  await expect(page.getByText('Points when there’s signal')).toBeVisible();
  await expect(page.getByText(/^No signal\. Keep logging/)).toBeVisible();
  await treadmill.getByLabel('Treadmill run, set 1, min').fill('25');
  await page.waitForTimeout(700); // the save to the phone is debounced
  await page.screenshot({ path: `${SCREENS}/offline-logger-${testInfo.project.name}.png` });
  await page.getByRole('button', { name: 'Finish workout' }).click();
  await expect(page.getByText(/^1 workout is waiting/)).toBeVisible();
  await page.screenshot({ path: `${SCREENS}/offline-waiting-${testInfo.project.name}.png` });

  await context.setOffline(false);
  await expect(page.getByText(/^Cardio sent: \+\d+ points\.$/)).toBeVisible({ timeout: 40000 });
  await expect(page.getByText(/^1 workout is waiting/)).toHaveCount(0);
});

test('put a gym on a real map and friends get a link to it', async ({ page }, testInfo) => {
  // The map library runs for real. Only the outside services are stood in for.
  const tiles: string[] = [];
  await page.route('**/tile.openstreetmap.org/**', (route) => {
    tiles.push(route.request().url());
    return route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.alloc(0) });
  });
  await page.route('**/api/places?*', (route) =>
    route.fulfill({
      json: [{ name: 'Tolón', address: 'Santa Fe 3200, Buenos Aires', lat: -34.589, lon: -58.41 }],
    }),
  );
  await logIn(page, 'santi', testInfo, 'offline');
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await page.goto('/me');
  await page.getByRole('button', { name: 'Profile and settings' }).click();
  await page.getByRole('button', { name: 'Add a gym' }).click();
  const sheet = page.getByRole('dialog', { name: 'Add a gym' });
  await expect(sheet.locator('.leaflet-container')).toBeVisible();
  await expect(sheet.locator('.leaflet-marker-icon')).toHaveCount(0);

  await sheet.getByRole('group', { name: 'Map' }).click({ position: { x: 150, y: 150 } });
  await expect(sheet.locator('.leaflet-marker-icon')).toHaveCount(1);
  // From the world view a tap closes in a little. It doesn't jump to a street it can't be sure of.
  await expect.poll(() => tiles.some((url) => /\.org\/6\//.test(url))).toBe(true);
  expect(tiles.some((url) => /\.org\/16\//.test(url))).toBe(false);

  await sheet.getByLabel(/^Search for a place/).fill('Santa Fe 3200');
  await sheet.getByRole('button', { name: 'Search' }).click();
  await expect(sheet.getByLabel('Name')).toHaveValue('Tolón');
  await expect(sheet.getByRole('link', { name: 'Open in Google Maps' })).toHaveAttribute(
    'href',
    /query=-34\.589,-58\.41$/,
  );
  await sheet.getByRole('button', { name: 'Save gym' }).click();
  await expect(page.getByRole('link', { name: 'Open Tolón in Google Maps' })).toBeVisible();
  await expect(page.locator('#root')).toHaveAttribute('inert', '');
  await page.screenshot({ path: `${SCREENS}/gym-saved-${testInfo.project.name}.png` });
});
