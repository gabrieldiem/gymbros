/**
 * "This is {crew}" is shown once, right after someone joins a crew (at sign-up or later).
 * The flag lives in localStorage so a reload before tapping "Let's go" still shows it.
 */
const KEY = 'gymbros.crewWelcome';

export function markCrewWelcomePending(): void {
  localStorage.setItem(KEY, '1');
}

export function isCrewWelcomePending(): boolean {
  return localStorage.getItem(KEY) === '1';
}

export function clearCrewWelcome(): void {
  localStorage.removeItem(KEY);
}
