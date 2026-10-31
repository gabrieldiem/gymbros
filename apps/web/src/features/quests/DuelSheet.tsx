import { useState } from 'react';

import { STAKES, useChallenge, type DuelMetric, type Stake } from '../../api/compete';
import { useMe } from '../../api/me';
import type { Actor } from '../../api/social';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { FormError } from '../../components/FormError';
import { Sheet } from '../../components/Sheet';
import { useToast } from '../../components/toast';
import { useI18n } from '../../i18n/context';
import styles from './Quests.module.css';

type Props = { members: Actor[]; winPoints: number; onClose: () => void };

/** Pick an opponent, what counts and the stake, then send the challenge. */
export function DuelSheet({ members, winPoints, onClose }: Props) {
  const { t } = useI18n();
  const myId = useMe().data?.id;
  const challenge = useChallenge();
  const showToast = useToast();
  const others = members.filter((m) => m.user_id !== myId);
  const [opponent, setOpponent] = useState<Actor | undefined>(others[0]);
  const [metric, setMetric] = useState<DuelMetric>('points');
  const [stake, setStake] = useState<Stake>('stake_shakes');

  const handleSend = () => {
    if (!opponent) return;
    challenge.mutate(
      { opponent_id: opponent.user_id, metric, stake },
      {
        onSuccess: () => {
          showToast(t('duel_sent', { name: opponent.display_name }));
          onClose();
        },
      },
    );
  };

  return (
    <Sheet title={t('start_duel')} onClose={onClose}>
      <p className={styles.muted}>{t('duel_pick', { n: winPoints })}</p>
      <div className={styles.picker}>
        <div role="group" aria-labelledby="duel-opponent">
          <span id="duel-opponent" className={styles.label}>
            {t('duel_opponent')}
          </span>
          <div className={styles.options}>
            {others.map((m) => (
              <button
                key={m.user_id}
                type="button"
                className={styles.option}
                aria-pressed={opponent?.user_id === m.user_id}
                onClick={() => setOpponent(m)}
              >
                <Avatar initials={m.initials} color={m.color} size={32} />
                {m.display_name}
              </button>
            ))}
          </div>
        </div>
        <div role="group" aria-labelledby="duel-metric">
          <span id="duel-metric" className={styles.label}>
            {t('duel_metric')}
          </span>
          <div className={styles.options}>
            {(['points', 'bench_volume'] as const).map((m) => (
              <button
                key={m}
                type="button"
                className={`${styles.option} ${styles.stakeOption}`}
                aria-pressed={metric === m}
                onClick={() => setMetric(m)}
              >
                {t(`metric_${m}`)}
              </button>
            ))}
          </div>
        </div>
        <div role="group" aria-labelledby="duel-stake">
          <span id="duel-stake" className={styles.label}>
            {t('duel_stake')}
          </span>
          <div className={styles.options}>
            {STAKES.map((s) => (
              <button
                key={s}
                type="button"
                className={`${styles.option} ${styles.stakeOption}`}
                aria-pressed={stake === s}
                onClick={() => setStake(s)}
              >
                {t(s)}
              </button>
            ))}
          </div>
        </div>
        <FormError error={challenge.error} />
        <Button wide onClick={handleSend} disabled={!opponent || challenge.isPending}>
          {t('send_duel')}
        </Button>
      </div>
    </Sheet>
  );
}
