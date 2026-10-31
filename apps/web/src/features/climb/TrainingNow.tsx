import { useEffect, useState } from 'react';

import { useTrainingNow } from '../../api/train';
import { Avatar } from '../../components/Avatar';
import { useI18n } from '../../i18n/context';
import styles from './TrainingNow.module.css';

function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** "Who's at the gym": chips for every crew member with a workout in progress. */
export function TrainingNow({ myId }: { myId: string | undefined }) {
  const { t } = useI18n();
  const now = useMinuteClock();
  const live = useTrainingNow().data ?? [];
  if (!live.length) return null;
  return (
    <section className={styles.section} aria-labelledby="training-now-title">
      <h2 id="training-now-title">
        <span className={styles.pulse} aria-hidden="true" />
        {t('training_now')}
      </h2>
      <ul className={styles.chips}>
        {live.map((item) => {
          const minutes = Math.max(1, Math.round((now - Date.parse(item.started_at)) / 60_000));
          return (
            <li key={item.user_id} className={styles.chip}>
              <Avatar initials={item.initials} color={item.color} size={34} />
              <span>
                {item.user_id === myId ? t('you') : item.display_name}
                <small>
                  {item.workout_name}, {t('min_n', { n: minutes })}
                </small>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
