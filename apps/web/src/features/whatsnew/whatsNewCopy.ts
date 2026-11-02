import type { MessageKey } from '../../i18n/en';

/**
 * The copy of each entry in `apps/api/src/resources/whats_new.json`, by id.
 * tests/whatsNew.test.tsx fails if an entry there has no copy here.
 */
export const WHATS_NEW_COPY: Record<string, { title: MessageKey; body: MessageKey }> = {
  'workout-details': { title: 'wn_workout_details_title', body: 'wn_workout_details_body' },
  'faster-sets': { title: 'wn_faster_sets_title', body: 'wn_faster_sets_body' },
  'past-workouts': { title: 'wn_past_workouts_title', body: 'wn_past_workouts_body' },
  'achievements-menu': { title: 'wn_achievements_menu_title', body: 'wn_achievements_menu_body' },
  'runs-and-swims': { title: 'wn_runs_and_swims_title', body: 'wn_runs_and_swims_body' },
};
