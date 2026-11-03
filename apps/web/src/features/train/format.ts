import type { MessageKey } from '../../i18n/en';
import type { Vars } from '../../i18n/translate';
import type { Exercise, LineItem, SetData } from '../../api/train';
import { DEFAULT_BAR_KG, disksOf } from './barbell';

type T = (key: MessageKey, vars?: Vars) => string;
type N = (value: number) => string;

/** "1:05", "12:30", "1:02:03" */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor(total / 60) % 60;
  const s = String(total % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/** A best set as text: "102.5 kg × 5", "+10 kg × 6", "12 reps", "10 km in 52 min" (cardio records
 * keep km and minutes in the load and reps fields). */
export function formatLift(
  exercise: Exercise | undefined,
  loadKg: number,
  reps: number,
  t: T,
  n: N,
  barKg?: number | null,
) {
  const bar = barKg ?? DEFAULT_BAR_KG;
  if (exercise?.barbell && loadKg >= bar) {
    return t('pr_disks', { kg: n(disksOf(loadKg, bar)), reps });
  }
  if (exercise?.type === 'c') return t('pr_distance', { km: n(loadKg), minutes: reps });
  if (exercise?.type === 'bw') {
    return loadKg > 0 ? t('pr_added', { kg: n(loadKg), reps }) : t('pr_reps', { reps });
  }
  return t('pr_load', { kg: n(loadKg), reps });
}

/** Last time's set in the logger's "Last time" column. */
export function formatPrevious(exercise: Exercise, set: SetData | undefined, n: N): string {
  if (!set) return '–';
  if (exercise.type === 's') return `${set.minutes ?? 0} min`;
  if (exercise.barbell && (set.load_kg ?? 0) > 0) {
    return `${n(disksOf(set.load_kg ?? 0, set.bar_kg ?? DEFAULT_BAR_KG))} × ${set.reps ?? 0}`;
  }
  if (exercise.type === 'c') return `${set.minutes ?? 0} min, ${n(set.km ?? 0)} km`;
  const load = set.load_kg ?? 0;
  const prefix = load === 0 ? 'BW' : exercise.type === 'bw' ? `+${n(load)}` : n(load);
  return `${prefix} × ${set.reps ?? 0}`;
}

/** A score line item (key + vars from the API) as copy in the current language. */
export function lineItemText(item: LineItem, exercises: Exercise[], t: T, n: N): string {
  const { key, vars } = item;
  switch (key) {
    case 'ln_sets':
      return vars.n === 1 ? t('ln_set1') : t('ln_sets', { n: Number(vars.n) });
    case 'ln_streak':
      return vars.weeks === 1 ? t('ln_streak1') : t('ln_streak', { weeks: Number(vars.weeks) });
    case 'ln_leg_event':
      return t('ln_leg_event', { w: t('leg_event_name'), n: Number(vars.n) });
    case 'ln_pr': {
      const exercise = exercises.find((e) => e.id === vars.exercise_id);
      const bar = vars.bar_kg === undefined ? null : Number(vars.bar_kg);
      const lift = formatLift(exercise, Number(vars.load_kg), Number(vars.reps), t, n, bar);
      return t('ln_pr', { x: `${exercise?.name ?? String(vars.exercise_id)} ${lift}` });
    }
    case 'ln_pr_distance': {
      const exercise = exercises.find((e) => e.id === vars.exercise_id);
      const best = t('pr_distance', { km: n(Number(vars.km)), minutes: Number(vars.minutes) });
      return t('ln_pr_distance', { x: `${exercise?.name ?? String(vars.exercise_id)} ${best}` });
    }
    case 'ln_distance':
      return t('ln_distance', { km: n(Number(vars.km)) });
    case 'ln_intensity':
      return t('ln_intensity', { minutes: Number(vars.minutes) });
    case 'ln_custom':
      return t('ln_custom');
    case 'ln_stretch':
    case 'ln_show':
    case 'ln_vol':
    case 'ln_cardio':
    case 'ln_goal':
    case 'ln_over':
    case 'ln_better':
    case 'ln_history':
    case 'ln_crew_quest':
    case 'ln_bounty':
    case 'ln_duel':
      return t(key, vars);
    case 'ln_quest':
      return t('ln_quest', { q: t(`quest_${String(vars.quest)}` as MessageKey) });
    case 'ln_badge':
      return t('ln_badge', { b: t(`badge_${String(vars.badge)}` as MessageKey) });
    default:
      return t('ln_unknown');
  }
}
