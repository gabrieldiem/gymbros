import type { MessageKey } from '../../i18n/en';
import type { Vars } from '../../i18n/translate';

type T = (key: MessageKey, vars?: Vars) => string;

/** "1 of 3 workouts this week. Two more to hit your goal." and friends. */
export function goalText(t: T, workouts: number, target: number): string {
  if (workouts === target) return t('goal_eq');
  if (workouts > target) return t('goal_gt', { n: workouts, x: workouts - target });
  const leftCount = target - workouts;
  const left =
    leftCount === 1
      ? t('goal_left_1')
      : leftCount === 2
        ? t('goal_left_2')
        : t('goal_left_n', { n: leftCount });
  return t('goal_lt', { n: workouts, target, left });
}
