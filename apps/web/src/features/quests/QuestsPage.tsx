import { useState } from 'react';

import { useBadges, useQuests } from '../../api/compete';
import { useMe } from '../../api/me';
import { Button, ButtonLink } from '../../components/Button';
import { cx } from '../../components/cx';
import { Segmented } from '../../components/Segmented';
import { useI18n } from '../../i18n/context';
import type { MessageKey } from '../../i18n/en';
import { Badges } from './Badges';
import { CrewQuest } from './CrewQuest';
import { DuelSheet } from './DuelSheet';
import { Duels } from './Duels';
import styles from './Quests.module.css';
import { questProgressText } from './questFormat';

type View = 'quests' | 'badges';

function QuestsView() {
  const { t, n } = useI18n();
  const board = useQuests().data;
  const myId = useMe().data?.id;
  const [duelOpen, setDuelOpen] = useState(false);
  if (!board) return <p role="status">{t('loading')}</p>;
  const winPoints = board.duel_points;
  const bounty = board.bounty;
  const members = board.crew_quest.shares.map((s) => s.member);
  return (
    <>
      <CrewQuest crew={board.crew_quest} />
      <div className={styles.cards}>
        {board.weekly_event === 'leg_day_x2' && (
          <article className={cx(styles.panel, styles.card, styles.event)}>
            <h3>{t('event_title', { w: t('leg_event_name') })}</h3>
            <p>
              {t('weather_desc')} {t('weather_more')}
            </p>
            <div className={styles.cta}>
              <ButtonLink to="/train" variant="ghost">
                {t('weather_cta')}
              </ButtonLink>
            </div>
          </article>
        )}
        <article className={cx(styles.panel, styles.card, styles.bounty)}>
          {bounty.claimed_by ? (
            <>
              <h3>{t('bounty_title', { name: bounty.claimed_by.display_name })}</h3>
              <p>{t('bounty_claimed', { name: bounty.claimed_by.display_name })}</p>
            </>
          ) : bounty.target ? (
            <>
              <h3>{t('bounty_title', { name: bounty.target.display_name })}</h3>
              <p>
                {bounty.target.user_id === myId
                  ? t('bounty_you')
                  : t('bounty_body', {
                      name: bounty.target.display_name,
                      pts: n(bounty.target_points),
                      n: bounty.points,
                    })}
              </p>
            </>
          ) : null}
        </article>
      </div>
      <h2>{t('weekly_quests')}</h2>
      <div className={styles.cards}>
        {board.quests.map((quest) => {
          const done = quest.claimed || quest.progress >= quest.goal;
          return (
            <article key={quest.id} className={cx(styles.panel, styles.quest, done && styles.done)}>
              <h3>{t(`quest_${quest.id}` as MessageKey)}</h3>
              <p className={styles.muted}>{t(`quest_${quest.id}_d` as MessageKey)}</p>
              <div
                className={styles.bar}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={quest.goal}
                aria-valuenow={Math.min(quest.progress, quest.goal)}
                aria-label={t(`quest_${quest.id}` as MessageKey)}
              >
                <i style={{ width: `${Math.min(100, (quest.progress / quest.goal) * 100)}%` }} />
              </div>
              <div className={styles.meta}>
                <span>{done ? t('complete') : questProgressText(quest, t, n)}</span>
                <b>+{quest.bonus}</b>
              </div>
            </article>
          );
        })}
      </div>
      <div className={styles.sectionHead}>
        <h2>{t('duels')}</h2>
        <Button variant="ghost" onClick={() => setDuelOpen(true)}>
          {t('start_duel')}
        </Button>
      </div>
      <Duels winPoints={winPoints} />
      {duelOpen && (
        <DuelSheet members={members} winPoints={winPoints} onClose={() => setDuelOpen(false)} />
      )}
    </>
  );
}

export function QuestsPage() {
  const { t } = useI18n();
  const [view, setView] = useState<View>('quests');
  const badges = useBadges().data;
  const unlocked = badges?.filter((b) => b.unlocked_at).length ?? 0;
  return (
    <section aria-labelledby="page-title">
      <div className={styles.head}>
        <div>
          <h1 id="page-title">{view === 'quests' ? t('quests_title') : t('badges_title')}</h1>
          <p className={styles.sub}>
            {view === 'quests'
              ? t('quests_sub')
              : t('badges_sub', { n: unlocked, t: badges?.length ?? 15 })}
          </p>
        </div>
        <Segmented
          label={t('quests_view')}
          value={view}
          onChange={setView}
          options={[
            { value: 'quests', label: t('quests_title') },
            { value: 'badges', label: t('badges_title') },
          ]}
        />
      </div>
      {view === 'quests' ? (
        <QuestsView />
      ) : badges ? (
        <Badges badges={badges} />
      ) : (
        <p role="status">{t('loading')}</p>
      )}
    </section>
  );
}
