import type { MessageKey } from '../i18n/en';
import { ApiError } from './client';

/** API error codes (`{"detail": {"code": ...}}`) and the copy each one shows. */
const CODE_MESSAGES: Record<string, MessageKey> = {
  invalid_credentials: 'err_invalid_credentials',
  email_taken: 'err_email_taken',
  invite_code_not_found: 'err_invite_code_not_found',
  already_in_crew: 'err_already_in_crew',
};

export function errorCode(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;
  const detail = (error.body as { detail?: unknown } | null)?.detail;
  if (detail && typeof detail === 'object' && 'code' in detail) {
    return String((detail as { code: unknown }).code);
  }
  return null;
}

/** The message key for any error thrown by an API hook. */
export function errorMessageKey(error: unknown): MessageKey {
  if (!(error instanceof ApiError)) return 'err_network';
  const code = errorCode(error);
  if (code && CODE_MESSAGES[code]) return CODE_MESSAGES[code];
  if (error.status === 422) return 'err_invalid_input';
  return 'err_generic';
}
