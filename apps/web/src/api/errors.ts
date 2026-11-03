import type { MessageKey } from '../i18n/en';
import { ApiError } from './client';

/** API error codes (`{"detail": {"code": ...}}`) and the copy each one shows. */
const CODE_MESSAGES: Record<string, MessageKey> = {
  admin_required: 'err_admin_required',
  invite_code_expired: 'err_invite_code_expired',
  invite_code_used_up: 'err_invite_code_used_up',
  invite_code_invalid: 'err_invite_code_invalid',
  invite_code_taken: 'err_invite_code_taken',
  invite_expiry_in_past: 'err_invite_expiry_in_past',
  already_in_this_crew: 'err_already_in_this_crew',
  member_in_other_crew: 'err_member_in_other_crew',
  invalid_time_zone: 'err_invalid_time_zone',
  crew_not_found: 'err_crew_not_found',
  member_has_no_crew: 'err_member_has_no_crew',
  cannot_delete_self: 'err_cannot_delete_self',
  delete_not_confirmed: 'err_delete_not_confirmed',
  invite_code_not_found: 'err_invite_code_not_found',
  already_in_crew: 'err_already_in_crew',
  workout_empty: 'err_workout_empty',
  steps_day_taken: 'err_steps_day_taken',
  steps_day_out_of_range: 'err_steps_out_of_range',
  steps_too_many: 'err_steps_too_many',
  steps_edit_expired: 'err_steps_edit_expired',
  workout_edit_expired: 'err_workout_edit_expired',
  places_unavailable: 'err_places_unavailable',
  map_link_not_understood: 'err_map_link_not_understood',
  nothing_to_digest: 'err_nothing_to_digest',
  too_much_feedback: 'err_too_much_feedback',
  feedback_not_found: 'err_feedback_not_found',
  invalid_avatar_text: 'err_invalid_avatar_text',
  image_too_large: 'err_image_too_large',
  image_not_supported: 'err_image_not_supported',
  gym_name_taken: 'err_gym_name_taken',
  too_many_gyms: 'err_too_many_gyms',
  gym_not_found: 'err_gym_not_found',
  stretching_already_logged: 'err_stretching_already_logged',
  workout_date_out_of_range: 'err_workout_date_out_of_range',
  workout_already_active: 'err_workout_already_active',
  workout_finished: 'err_workout_finished',
  workout_not_found: 'err_workout_finished',
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
