import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { logIn } from './members';

// Run through `make e2e`. Audits every screen against WCAG 2.1 A/AA with axe-core.
// Reduced motion: audits see settled screens, and the reduced-motion paths get exercised.
test.use({ reducedMotion: 'reduce' });

async function audit(page: Page, name: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const serious = results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${name}: ${v.id} (${v.nodes.length}) ${v.nodes[0]?.target.join(' ')}`);
  expect(serious, serious.join('\n')).toEqual([]);
}

test('signed-out screens', async ({ page }) => {
  for (const path of [
    '/',
    '/login',
    '/login?auth_error=google',
    '/privacy',
    '/terms',
    '/invite/E2EMOBILE',
  ]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await audit(page, path);
  }
});

test('every tab and the main sheets', async ({ page }, testInfo) => {
  await logIn(page, 'matex', testInfo);

  await audit(page, 'climb');
  for (const path of [
    '/crew',
    '/train',
    '/quests',
    '/quests/achievements',
    '/quests/points',
    '/whats-new',
    '/me', // last: the settings sheet below opens from here
  ]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.waitForLoadState('networkidle');
    await audit(page, path);
  }
  await page.getByRole('button', { name: /Profile and settings|Perfil y ajustes/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await audit(page, 'settings sheet');
  await page.getByRole('button', { name: /^(Add a gym|Añadir un gimnasio)$/ }).click();
  await expect(page.locator('.leaflet-container')).toBeVisible();
  await page.locator('.leaflet-container').click({ position: { x: 150, y: 150 } });
  await expect(page.locator('.leaflet-marker-icon')).toBeVisible();
  await audit(page, 'gym picker');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /Your profile|Tu perfil/ }).click();
  await expect(page.getByRole('menu')).toBeVisible();
  await audit(page, 'profile menu');
});

test('backoffice', async ({ page }, testInfo) => {
  await logIn(page, 'gabi', testInfo);
  await page.goto('/admin');
  await expect(page.getByRole('heading', { level: 1, name: 'Backoffice' })).toBeVisible();
  await page.waitForLoadState('networkidle');
  await audit(page, 'admin overview');
  await page.getByRole('button', { name: /^(Accounts|Cuentas)$/ }).click();
  await page.waitForLoadState('networkidle');
  await audit(page, 'admin accounts');
  await page.getByRole('button', { name: /^Email$/ }).click();
  await expect(
    page.getByRole('heading', { name: /Automatic emails|Emails automáticos/ }),
  ).toBeVisible();
  await audit(page, 'admin email');
  await page.getByRole('button', { name: /^(Feedback|Comentarios)$/ }).click();
  await page.waitForLoadState('networkidle');
  await audit(page, 'admin feedback');
  await page.getByRole('button', { name: /^(Crews|Equipos)$/ }).click();
  await page.waitForLoadState('networkidle');
  await audit(page, 'admin crews');
  await page.getByRole('button', { name: /E2E/ }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await audit(page, 'admin crew sheet');
});
