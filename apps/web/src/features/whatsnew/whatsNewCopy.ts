import type { MessageKey } from '../../i18n/en';

/**
 * The copy of each entry in `apps/api/src/resources/whats_new.json`, by id.
 * tests/whatsNew.test.tsx fails if an entry there has no copy here.
 */
export const WHATS_NEW_COPY: Record<string, { title: MessageKey; body: MessageKey }> = {
  'weekly-email': { title: 'wn_weekly_email_title', body: 'wn_weekly_email_body' },
  offline: { title: 'wn_offline_title', body: 'wn_offline_body' },
  export: { title: 'wn_export_title', body: 'wn_export_body' },
  feedback: { title: 'wn_feedback_title', body: 'wn_feedback_body' },
  photos: { title: 'wn_photos_title', body: 'wn_photos_body' },
  profile: { title: 'wn_profile_title', body: 'wn_profile_body' },
  gyms: { title: 'wn_gyms_title', body: 'wn_gyms_body' },
  'rest-timer': { title: 'wn_rest_timer_title', body: 'wn_rest_timer_body' },
  stretching: { title: 'wn_stretching_title', body: 'wn_stretching_body' },
  'workout-details': { title: 'wn_workout_details_title', body: 'wn_workout_details_body' },
  'faster-sets': { title: 'wn_faster_sets_title', body: 'wn_faster_sets_body' },
  'past-workouts': { title: 'wn_past_workouts_title', body: 'wn_past_workouts_body' },
  'achievements-menu': { title: 'wn_achievements_menu_title', body: 'wn_achievements_menu_body' },
  'runs-and-swims': { title: 'wn_runs_and_swims_title', body: 'wn_runs_and_swims_body' },
};
