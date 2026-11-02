const KEY = 'gymbros.invite';

/** Keep an invite code through the trip to Google and back, for the join screen to fill in. */
export function rememberInvite(code: string) {
  localStorage.setItem(KEY, code);
}

export function pendingInvite(): string {
  return localStorage.getItem(KEY) ?? '';
}

export function forgetInvite() {
  localStorage.removeItem(KEY);
}

/** Codes are case-insensitive and may be typed with spaces or dashes, as on the server. */
export function normalizeCode(code: string): string {
  return code.toUpperCase().replace(/[^\p{L}\p{N}]/gu, '');
}

/** The link that invites someone to this crew. */
export function inviteUrl(code: string): string {
  return `${window.location.origin}/invite/${encodeURIComponent(code)}`;
}
