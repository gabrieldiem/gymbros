import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Needs `make up` and `make seed`. Audits every screen against WCAG 2.1 A/AA with axe-core.
// Reduced motion: audits see settled screens, and the reduced-motion paths get exercised.
test.use({ reducedMotion: 'reduce' });

const DEMO_PASSWORD = 'climb-demo-2026';
const USERS: Record<string, string> = {
  mobile: 'jose@demo.gymbros.app',
  desktop: 'matex@demo.gymbros.app',
};

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
  for (const path of ['/welcome', '/login', '/register']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await audit(page, path);
  }
});

test('every tab and the main sheets', async ({ page }, testInfo) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(USERS[testInfo.project.name] ?? '');
  await page.getByLabel('Password').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: /Log in|Entrar/ }).click();
  await expect(page).toHaveURL(/\/climb$/);

  await audit(page, 'climb');
  for (const path of ['/crew', '/train', '/quests', '/me']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.waitForLoadState('networkidle');
    await audit(page, path);
  }
  await page.getByRole('button', { name: /Settings|Ajustes/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await audit(page, 'settings sheet');
});
