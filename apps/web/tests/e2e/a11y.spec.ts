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
  for (const path of ['/welcome', '/login', '/login?auth_error=google']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await audit(page, path);
  }
});

test('every tab and the main sheets', async ({ page }, testInfo) => {
  await logIn(page, 'matex', testInfo);

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
