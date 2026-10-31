import type { Exercise } from '../../api/train';
import type { Notification, PostedSet } from '../../api/social';
import type { MessageKey } from '../../i18n/en';
import type { Vars } from '../../i18n/translate';

type T = (key: MessageKey, vars?: Vars) => string;
type N = (value: number) => string;

/** One posted set: "110×3", "+15×8", "BW×10", "28 min, 5 km". */
export function formatPostedSet(exercise: Exercise | undefined, set: PostedSet, n: N): string {
  if (exercise?.type === 'c') return `${set.minutes ?? 0} min, ${n(set.km ?? 0)} km`;
  const load = set.load_kg ?? 0;
  if (exercise?.type === 'bw') return `${load > 0 ? `+${n(load)}` : 'BW'}×${set.reps ?? 0}`;
  return `${n(load)}×${set.reps ?? 0}`;
}

const REACTION_EMOJI: Record<string, string> = { fist: '👊', fire: '🔥' };

/** A notification (key + vars from the API) as copy in the current language. */
export function notificationText(item: Notification, t: T): string {
  const vars = item.vars;
  switch (item.key) {
    case 'n_react':
      return t('n_react', {
        name: String(vars.name),
        emoji: REACTION_EMOJI[String(vars.kind)] ?? '👊',
      });
    case 'n_passed':
    case 'n_behind':
    case 'n_goal':
    case 'n_comment':
    case 'n_nudge':
      return t(item.key, vars);
    default:
      return t('n_unknown');
  }
}
