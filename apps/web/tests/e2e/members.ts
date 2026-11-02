import { expect, type Page, type TestInfo } from '@playwright/test';

// `make e2e` rebuilds one crew per Playwright project (E2E Mobile, E2E Desktop) from the demo
// data before every run, so specs never touch the demo crew and the two viewports never share a
// member. Within a project each spec logs in as its own member, and specs that post workouts use
// a crew of their own ('train'), so they can't change what the other specs read.
export type MemberKey = 'gabi' | 'maxo' | 'santi' | 'jose' | 'matex';

export type E2eCrew = 'main' | 'train' | 'offline';

export function memberEmail(member: MemberKey, testInfo: TestInfo, crew: E2eCrew = 'main'): string {
  const project = crew === 'main' ? testInfo.project.name : `${crew}-${testInfo.project.name}`;
  return `${member}@${project}.e2e.gymbros.app`;
}

/** Log in on the login screen and wait for ATUS Climb. */
export async function logIn(
  page: Page,
  member: MemberKey,
  testInfo: TestInfo,
  crew: E2eCrew = 'main',
) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(memberEmail(member, testInfo, crew));
  await page.getByRole('button', { name: /Log in|Entrar/ }).click();
  await expect(page).toHaveURL(/\/climb$/);
}
