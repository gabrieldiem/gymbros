import type { PastDay } from '../../api/train';
import { Sheet } from '../../components/Sheet';
import { useI18n } from '../../i18n/context';
import { formatDay } from '../../i18n/formatDay';
import styles from './PastDaySheet.module.css';

type Props = {
  days: PastDay[];
  onPick: (day: string) => void;
  onClose: () => void;
};

/** Pick the day of a workout you forgot to log. The server says which days are allowed. */
export function PastDaySheet({ days, onPick, onClose }: Props) {
  const { t, lang } = useI18n();
  return (
    <Sheet title={t('past_title')} onClose={onClose}>
      <p className={styles.hint}>{t('past_hint', { n: days.length })}</p>
      <ul className={styles.days}>
        {days.map(({ day, workouts }, index) => (
          <li key={day}>
            <button type="button" onClick={() => onPick(day)}>
              <b>
                {index === 0
                  ? `${t('past_yesterday')}, ${formatDay(lang, day)}`
                  : formatDay(lang, day)}
              </b>
              {workouts > 0 && <span>{t('past_logged', { n: workouts })}</span>}
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
