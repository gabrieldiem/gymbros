import type { MessageKey } from '../../i18n/en';

/**
 * The copy of each entry in `apps/api/src/resources/whats_new.json`, by id.
 * tests/whatsNew.test.tsx fails if an entry there has no copy here.
 */
export const WHATS_NEW_COPY: Record<
  string,
  { title: MessageKey; body: MessageKey; points: MessageKey }
> = {
  'ways-to-train': {
    title: 'wn_ways_to_train_title',
    body: 'wn_ways_to_train_body',
    points: 'wn_ways_to_train_points',
  },
  'more-exercises': {
    title: 'wn_more_exercises_title',
    body: 'wn_more_exercises_body',
    points: 'wn_more_exercises_points',
  },
  'edit-workout': {
    title: 'wn_edit_workout_title',
    body: 'wn_edit_workout_body',
    points: 'wn_edit_workout_points',
  },
  'gym-map': { title: 'wn_gym_map_title', body: 'wn_gym_map_body', points: 'wn_gym_map_points' },
  'weekly-email': {
    title: 'wn_weekly_email_title',
    body: 'wn_weekly_email_body',
    points: 'wn_weekly_email_points',
  },
  offline: { title: 'wn_offline_title', body: 'wn_offline_body', points: 'wn_offline_points' },
  export: { title: 'wn_export_title', body: 'wn_export_body', points: 'wn_export_points' },
  feedback: { title: 'wn_feedback_title', body: 'wn_feedback_body', points: 'wn_feedback_points' },
  photos: { title: 'wn_photos_title', body: 'wn_photos_body', points: 'wn_photos_points' },
  profile: { title: 'wn_profile_title', body: 'wn_profile_body', points: 'wn_profile_points' },
  gyms: { title: 'wn_gyms_title', body: 'wn_gyms_body', points: 'wn_gyms_points' },
  'rest-timer': {
    title: 'wn_rest_timer_title',
    body: 'wn_rest_timer_body',
    points: 'wn_rest_timer_points',
  },
  stretching: {
    title: 'wn_stretching_title',
    body: 'wn_stretching_body',
    points: 'wn_stretching_points',
  },
  'workout-details': {
    title: 'wn_workout_details_title',
    body: 'wn_workout_details_body',
    points: 'wn_workout_details_points',
  },
  'faster-sets': {
    title: 'wn_faster_sets_title',
    body: 'wn_faster_sets_body',
    points: 'wn_faster_sets_points',
  },
  'past-workouts': {
    title: 'wn_past_workouts_title',
    body: 'wn_past_workouts_body',
    points: 'wn_past_workouts_points',
  },
  'achievements-menu': {
    title: 'wn_achievements_menu_title',
    body: 'wn_achievements_menu_body',
    points: 'wn_achievements_menu_points',
  },
  'runs-and-swims': {
    title: 'wn_runs_and_swims_title',
    body: 'wn_runs_and_swims_body',
    points: 'wn_runs_and_swims_points',
  },
};
