import type { Quest } from '../../api/compete';
import type { MessageKey } from '../../i18n/en';
import type { Vars } from '../../i18n/translate';

type T = (key: MessageKey, vars?: Vars) => string;
type N = (value: number) => string;

/** "1 of 2", "12.4 of 20 t", "45 of 60 min". */
export function questProgressText(quest: Quest, t: T, n: N): string {
  const shown =
    quest.id === 'tonnes' ? Math.round(quest.progress * 10) / 10 : Math.floor(quest.progress);
  const goal =
    quest.id === 'tonnes'
      ? t('unit_t', { n: n(quest.goal) })
      : quest.id === 'cardio'
        ? t('unit_min', { n: n(quest.goal) })
        : n(quest.goal);
  return t('of', { a: n(Math.min(shown, quest.goal)), b: goal });
}
