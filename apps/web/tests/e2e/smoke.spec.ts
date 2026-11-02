import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { memberEmail } from './members';

// Needs `make up`; run through `make e2e`, which rebuilds the e2e crews first.
const SCREENS = 'test-results/screens';

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    // The browser logs the expected 401 from /api/me while signed out.
    if (message.type() === 'error' && !message.text().includes('status of 401')) {
      errors.push(message.text());
    }
  });
  return errors;
}

async function expectNoSidewaysScroll(page: Page) {
  const width = page.viewportSize()?.width ?? 0;
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
}

async function shoot(page: Page, name: string, testInfo: TestInfo) {
  await page.screenshot({ path: `${SCREENS}/${name}-${testInfo.project.name}.png` });
}

test('signed out: landing and login screens in both languages', async ({ page }, testInfo) => {
  const errors = collectErrors(page);
  await page.goto('/climb');
  await expect(page).toHaveURL(/:\d+\/$/);
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Climb with your crew.' }),
  ).toBeVisible();
  await expectNoSidewaysScroll(page);
  await page.waitForTimeout(3200); // the map's intro climb
  await page.screenshot({
    path: `${SCREENS}/landing-full-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await shoot(page, 'landing-en', testInfo);

  await page.getByRole('button', { name: 'ES', exact: true }).click();
  await page.getByRole('link', { name: 'Entrar', exact: true }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Hola de nuevo' })).toBeVisible();
  await shoot(page, 'login-es', testInfo);
  expect(errors).toEqual([]);
});

test('Google button: starts the sign-in in the chosen language', async ({ page }, testInfo) => {
  // The dev stack has no Google credentials unless they're in .env, so the server's answer is faked.
  await page.route('**/api/auth/options', (route) =>
    route.fulfill({ json: { google: true, dev_login: false } }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'ES', exact: true }).click();
  const button = page.getByRole('link', { name: 'Continuar con Google' }).first();
  await expect(button).toHaveAttribute('href', '/api/auth/google/start?lang=es');
  const box = await button.boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(44);
  await expectNoSidewaysScroll(page);
  await shoot(page, 'landing-google-es', testInfo);

  await page.goto('/login?auth_error=google');
  await expect(page.getByRole('alert')).toContainText('Google');
  await shoot(page, 'login-google-error', testInfo);
});

test('legal pages: public, in Spanish, nothing overflows', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'ES', exact: true }).click();
  await page.getByRole('link', { name: 'Política de privacidad' }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Política de privacidad' }),
  ).toBeVisible();
  await expectNoSidewaysScroll(page);
  await page.screenshot({
    path: `${SCREENS}/privacy-es-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.goto('/terms');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Términos del servicio' }),
  ).toBeVisible();
  await expectNoSidewaysScroll(page);
  await page.screenshot({
    path: `${SCREENS}/terms-es-${testInfo.project.name}.png`,
    fullPage: true,
  });
});

test('member: log in, see the tabs, language follows the profile, log out', async ({
  page,
}, testInfo) => {
  const errors = collectErrors(page);
  await page.goto('/login');
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await page.getByLabel('Email').fill(memberEmail('gabi', testInfo));
  await page.getByRole('button', { name: 'Log in' }).click();

  await expect(page).toHaveURL(/\/climb$/);
  // Normalise the profile language, whatever an earlier run left behind.
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Better than/ })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Rope order' }).getByRole('listitem')).toHaveCount(
    5,
  );
  await page.waitForTimeout(2800); // intro climb animation
  await expect(page.getByRole('status').filter({ hasText: 'Server online' })).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Main' });
  // Train's name also says "Training now" while a workout is in progress.
  for (const name of [/^ATUS Climb$/, /^Crew$/, /^Train\b/, /^Quests$/, /^You$/]) {
    await expect(nav.getByRole('link', { name })).toBeVisible();
  }
  await expect(page.getByRole('button', { name: /Your profile/ })).toBeVisible();
  await expectNoSidewaysScroll(page);
  await shoot(page, 'climb-en', testInfo);
  await page.screenshot({
    path: `${SCREENS}/climb-full-${testInfo.project.name}.png`,
    fullPage: true,
  });

  const profileSaved = page.waitForResponse(
    (r) => r.url().endsWith('/api/me') && r.request().method() === 'PATCH',
  );
  await page.getByRole('button', { name: 'ES', exact: true }).click();
  await profileSaved;
  await page
    .getByRole('navigation', { name: 'Principal' })
    .getByRole('link', { name: 'Equipo', exact: true })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Equipo' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Equipo' })).toBeVisible();
  await shoot(page, 'crew-es', testInfo);

  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await page.getByRole('button', { name: /Your profile/ }).click();
  await expect(page.getByRole('menu')).toBeVisible();
  await shoot(page, 'profile-menu', testInfo);
  await page.getByRole('menuitem', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/:\d+\/$/);
  expect(errors).toEqual([]);
});

test('backoffice: an admin opens it from the menu, a member is sent away', async ({
  page,
}, testInfo) => {
  const errors = collectErrors(page);
  await page.goto('/login');
  await page.getByLabel('Email').fill(memberEmail('maxo', testInfo));
  await page.getByRole('button', { name: /Log in|Entrar/ }).click();
  await expect(page).toHaveURL(/\/climb$/);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/climb$/);
  await page.getByRole('button', { name: /Your profile|Tu perfil/ }).click();
  await page.getByRole('menuitem', { name: /Log out|Salir|Cerrar/ }).click();
  await expect(page).toHaveURL(/:\d+\/$/);

  await page.goto('/login');
  await page.getByLabel('Email').fill(memberEmail('gabi', testInfo));
  await page.getByRole('button', { name: /Log in|Entrar/ }).click();
  await expect(page).toHaveURL(/\/climb$/);
  await page.getByRole('button', { name: /Your profile|Tu perfil/ }).click();
  await page.getByRole('menuitem', { name: 'Backoffice' }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Backoffice' })).toBeVisible();
  await expectNoSidewaysScroll(page);
  await page.waitForTimeout(1100);
  await shoot(page, 'admin-overview', testInfo);
  await page.getByRole('button', { name: /^(Accounts|Cuentas)$/ }).click();
  await expect(page.getByText(`maxo@${testInfo.project.name}.e2e.gymbros.app`)).toBeVisible();
  await expectNoSidewaysScroll(page);
  await shoot(page, 'admin-members', testInfo);
  expect(errors).toEqual([]);
});

test('invite link: shows the crew before signing in', async ({ page }, testInfo) => {
  const errors = collectErrors(page);
  const crew = testInfo.project.name === 'mobile' ? 'E2EMOBILE' : 'E2EDESKTOP';
  await page.goto(`/invite/${crew}`);
  await expect(page.getByRole('heading', { level: 1, name: /E2E/ })).toBeVisible();
  await expectNoSidewaysScroll(page);
  await shoot(page, 'invite', testInfo);
  await page.goto('/invite/NOTACODE');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/doesn’t work|no funciona/);
  expect(errors.filter((e) => !e.includes('status of 404'))).toEqual([]);
});

test('invite limits: an admin sets a custom code with one use, then the link joins and runs out', async ({
  browser,
  page,
}, testInfo) => {
  const stamp = Date.now().toString(36).toUpperCase().slice(-6);
  const code = `T${stamp}${testInfo.project.name === 'mobile' ? 'M' : 'D'}`;
  await page.goto('/login');
  await page.getByLabel('Email').fill(memberEmail('gabi', testInfo));
  await page.getByRole('button', { name: /Log in|Entrar/ }).click();
  await expect(page).toHaveURL(/\/climb$/);
  await page.goto('/admin');
  await page.getByRole('button', { name: /^(Crews|Equipos)$/ }).click();
  await page.getByRole('button', { name: /New crew|Nuevo equipo/ }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByLabel(/Crew name|Nombre del equipo/).fill(`Invite ${code}`);
  await sheet.getByLabel(/^(Code|Código)/).fill(code);
  await sheet.getByLabel(/Maximum uses|Usos máximos/).fill('1');
  await page.waitForTimeout(100);
  await page.screenshot({
    path: `${SCREENS}/admin-crew-sheet-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await sheet.getByRole('button', { name: /^(Save|Guardar)$/ }).click();
  await expect(page.getByRole('button', { name: new RegExp(`Invite ${code}`) })).toBeVisible();

  const signInAndOpen = async (name: string) => {
    const context = await browser.newContext({ locale: 'en-US' });
    const visitor = await context.newPage();
    await visitor.goto('/login');
    await visitor.getByLabel('Email').fill(`${name}-${code.toLowerCase()}@example.com`);
    await visitor.getByRole('button', { name: /Log in|Entrar/ }).click();
    await expect(visitor).toHaveURL(/\/join$/);
    await visitor.goto(`/invite/${code.toLowerCase()}`);
    return { context, visitor };
  };

  const first = await signInAndOpen('first');
  await expect(
    first.visitor.getByRole('heading', { name: `This is Invite ${code}` }),
  ).toBeVisible();
  await first.context.close();

  const second = await signInAndOpen('second');
  await expect(second.visitor.getByRole('alert')).toContainText('used up');
  await expect(second.visitor).toHaveURL(/\/join$/);
  await second.context.close();
});

test('navbar: the indicator sits on the active tab and follows it', async ({ page }, testInfo) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(memberEmail('maxo', testInfo));
  await page.getByRole('button', { name: /Log in|Entrar/ }).click();
  await expect(page).toHaveURL(/\/climb$/);
  const nav = page.getByRole('navigation', { name: /Main|Principal/ });
  const indicator = nav.locator('[class*="indicator"]');

  const expectOnTab = async (name: RegExp) => {
    const tab = nav.getByRole('link', { name, exact: false }).first();
    await expect(tab).toHaveAttribute('aria-current', 'page');
    await expect
      .poll(async () => {
        const [a, b] = await Promise.all([indicator.boundingBox(), tab.boundingBox()]);
        if (!a || !b) return Number.POSITIVE_INFINITY;
        return Math.max(
          Math.abs(a.x - b.x),
          Math.abs(a.y - b.y),
          Math.abs(a.width - b.width),
          Math.abs(a.height - b.height),
        );
      })
      .toBeLessThan(2);
  };

  await expectOnTab(/^(ATUS Climb)$/);
  await nav.getByRole('link', { name: /^(Crew|Equipo)$/ }).click();
  await expectOnTab(/^(Crew|Equipo)$/);
  await nav
    .getByRole('link', { name: /^(Quests|Retos)$/ })
    .first()
    .click();
  await expectOnTab(/^(Quests|Retos)$/);
  await page.goto('/quests/achievements');
  await expectOnTab(/^(Quests|Retos)$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Achievements|Logros/);

  // Train has its own button, so the indicator hides.
  await nav.getByRole('link', { name: /^(Train|Entrenar)/ }).click();
  await expect(indicator).toHaveCSS('opacity', '0');
});
