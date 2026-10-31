import { useDuels, useRespondDuel, type Duel } from '../../api/compete';
import { useMe } from '../../api/me';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { useI18n } from '../../i18n/context';
import styles from './Quests.module.css';

function DuelCard({ duel, myId, winPoints }: { duel: Duel; myId: string; winPoints: number }) {
  const { t, n } = useI18n();
  const respond = useRespondDuel();
  const mine = duel.challenger.user_id === myId;
  const [me, them] = mine ? [duel.challenger, duel.opponent] : [duel.opponent, duel.challenger];
  const [myValue, theirValue] = mine
    ? [duel.challenger_value, duel.opponent_value]
    : [duel.opponent_value, duel.challenger_value];
  const unit = duel.metric === 'bench_volume' ? ' kg' : ' pts';
  const max = Math.max(myValue, theirValue, 1);
  const lead = myValue - theirValue;
  const title = t(duel.metric === 'bench_volume' ? 'duel_bench' : 'duel_pts', {
    name: them.display_name,
  });

  return (
    <article className={`${styles.panel} ${styles.duel}`} aria-label={title}>
      <h3>{title}</h3>
      <p className={styles.muted}>
        {t(duel.metric === 'bench_volume' ? 'duel_desc_bench' : 'duel_desc_pts')} {t(duel.stake)}
      </p>
      {[
        [me, myValue],
        [them, theirValue],
      ].map(([who, value]) => {
        const actor = who as Duel['challenger'];
        return (
          <div key={actor.user_id} className={styles.duelRow}>
            <Avatar initials={actor.initials} color={actor.color} size={36} />
            <div className={styles.bar}>
              <i style={{ width: `${(Number(value) / max) * 100}%` }} />
            </div>
            <b>
              {n(Number(value))}
              {unit}
            </b>
          </div>
        );
      })}
      {duel.status === 'pending' && !mine && (
        <>
          <p className={styles.status}>{t('duel_pending_in', { name: them.display_name })}</p>
          <div className={styles.actions}>
            <Button
              onClick={() => respond.mutate({ id: duel.id, accept: true })}
              disabled={respond.isPending}
            >
              {t('accept')}
            </Button>
            <Button
              variant="ghost"
              onClick={() => respond.mutate({ id: duel.id, accept: false })}
              disabled={respond.isPending}
            >
              {t('decline')}
            </Button>
          </div>
        </>
      )}
      {duel.status === 'pending' && mine && (
        <p className={styles.status}>{t('duel_pending_out', { name: them.display_name })}</p>
      )}
      {duel.status === 'declined' && (
        <p className={styles.status}>{t('duel_declined', { name: duel.opponent.display_name })}</p>
      )}
      {duel.status === 'active' && (
        <p className={`${styles.status} ${lead >= 0 ? styles.lead : ''}`}>
          {lead >= 0
            ? t('lead_by', { n: `${n(lead)}${unit}` })
            : t('behind', { n: `${n(-lead)}${unit}` })}
        </p>
      )}
      {duel.status === 'settled' && (
        <p className={styles.status}>
          {duel.winner_id === null
            ? t('duel_tie')
            : duel.winner_id === myId
              ? t('duel_won', { n: winPoints })
              : t('duel_lost')}
        </p>
      )}
    </article>
  );
}

/** This week's duels for the signed-in member. */
export function Duels({ winPoints }: { winPoints: number }) {
  const { t } = useI18n();
  const duels = useDuels().data;
  const myId = useMe().data?.id ?? '';
  if (!duels) return null;
  if (!duels.length) return <p className={styles.muted}>{t('duels_empty')}</p>;
  return (
    <div className={styles.cards}>
      {duels.map((duel) => (
        <DuelCard key={duel.id} duel={duel} myId={myId} winPoints={winPoints} />
      ))}
    </div>
  );
}
