import type { MessageKey } from '../../i18n/en';
import type { Vars } from '../../i18n/translate';
import type { Exercise, LineItem, SetData } from '../../api/train';

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

/** A best set as text: "102.5 kg × 5", "+10 kg × 6", "12 reps". */
export function formatLift(
  exercise: Exercise | undefined,
  loadKg: number,
  reps: number,
  t: T,
  n: N,
) {
  if (exercise?.type === 'bw') {
    return loadKg > 0 ? t('pr_added', { kg: n(loadKg), reps }) : t('pr_reps', { reps });
  }
  return t('pr_load', { kg: n(loadKg), reps });
}

/** Last time's set in the logger's "Last time" column. */
export function formatPrevious(exercise: Exercise, set: SetData | undefined, n: N): string {
  if (!set) return '–';
  if (exercise.type === 'c') return `${set.minutes ?? 0} min, ${n(set.km ?? 0)} km`;
  const load = set.load_kg ?? 0;
  const prefix = exercise.type === 'bw' ? (load > 0 ? `+${n(load)}` : 'BW') : n(load);
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
      const lift = formatLift(exercise, Number(vars.load_kg), Number(vars.reps), t, n);
      return t('ln_pr', { x: `${exercise?.name ?? String(vars.exercise_id)} ${lift}` });
    }
    case 'ln_show':
    case 'ln_vol':
    case 'ln_cardio':
    case 'ln_goal':
    case 'ln_over':
    case 'ln_better':
    case 'ln_history':
      return t(key, vars);
    default:
      return t('ln_unknown');
  }
}
