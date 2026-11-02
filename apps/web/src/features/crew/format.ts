import type { Exercise } from '../../api/train';
import type { Notification, PostedSet } from '../../api/social';
import type { MessageKey } from '../../i18n/en';
import type { Vars } from '../../i18n/translate';
import { WHATS_NEW_COPY } from '../whatsnew/whatsNewCopy';

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

function whatsNewText(item: Notification, t: T): string {
  const count = Number(item.vars.n);
  if (count > 1) return t('n_whats_new_many', { n: count });
  const copy = WHATS_NEW_COPY[String(item.vars.feature)];
  return copy ? t('n_whats_new', { title: t(copy.title) }) : t('n_whats_new_other');
}

/** A notification (key + vars from the API) as copy in the current language. */
export function notificationText(item: Notification, t: T): string {
  const vars = item.vars;
  switch (item.key) {
    case 'n_react':
      return t('n_react', {
        name: String(vars.name),
        emoji: REACTION_EMOJI[String(vars.kind)] ?? '👊',
      });
    case 'n_whats_new':
      return whatsNewText(item, t);
    case 'n_points_adjusted': {
      const points = Number(vars.points);
      const reason = String(vars.reason);
      return points >= 0
        ? t('n_points_added', { n: points, reason })
        : t('n_points_removed', { n: -points, reason });
    }
    case 'n_reply':
    case 'n_passed':
    case 'n_behind':
    case 'n_goal':
    case 'n_comment':
    case 'n_nudge':
    case 'n_duel_invite':
    case 'n_duel_accepted':
    case 'n_duel_declined':
    case 'n_duel_won':
      return t(item.key, vars);
    default:
      return t('n_unknown');
  }
}
