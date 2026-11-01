import { expect, type Page, type TestInfo } from '@playwright/test';

// `make e2e` rebuilds one crew per Playwright project (E2E Mobile, E2E Desktop) from the demo
// data before every run, so specs never touch the demo crew and the two viewports never share a
// member. Within a project each spec logs in as its own member.
export type MemberKey = 'gabi' | 'maxo' | 'santi' | 'jose' | 'matex';

export function memberEmail(member: MemberKey, testInfo: TestInfo): string {
  return `${member}@${testInfo.project.name}.e2e.gymbros.app`;
}

/** Log in on the login screen and wait for ATUS Climb. */
export async function logIn(page: Page, member: MemberKey, testInfo: TestInfo) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(memberEmail(member, testInfo));
  await page.getByRole('button', { name: /Log in|Entrar/ }).click();
  await expect(page).toHaveURL(/\/climb$/);
}
