import { Dumbbell, Swords } from 'lucide-react';
import { useState } from 'react';
import { useLocation } from 'react-router';

import { useBadges, useQuests } from '../../api/compete';
import { useMe } from '../../api/me';
import { useRules } from '../../api/rules';
import { Button, ButtonLink } from '../../components/Button';
import { cx } from '../../components/cx';
import { ErrorBlock, LoadingBlock, QueryState } from '../../components/QueryState';
import { TimedEventCard } from '../../components/TimedEvent';
import { useI18n } from '../../i18n/context';
import type { MessageKey } from '../../i18n/en';
import { PointsList, SportsCompare } from '../landing/LandingSections';
import { Badges } from './Badges';
import { CrewQuest } from './CrewQuest';
import { DuelSheet } from './DuelSheet';
import { Duels } from './Duels';
import styles from './Quests.module.css';
import { QuestsNav } from './QuestsNav';
import { questProgressText } from './questFormat';

function QuestsView() {
  const { t, n } = useI18n();
  const quests = useQuests();
  const board = quests.data;
  const myId = useMe().data?.id;
  const [duelOpen, setDuelOpen] = useState(false);
  if (!board) {
    return quests.isError ? (
      <ErrorBlock message="quests_failed" onRetry={() => void quests.refetch()} />
    ) : (
      <LoadingBlock />
    );
  }
  const winPoints = board.duel_points;
  const bounty = board.bounty;
  const members = board.crew_quest.shares.map((s) => s.member);
  return (
    <>
      <CrewQuest crew={board.crew_quest} />
      <div className={`${styles.cards} stagger`}>
        {board.weekly_event === 'leg_day_x2' && (
          <TimedEventCard endsAt={board.ends_at}>
            <div className={styles.cta}>
              <ButtonLink icon={Dumbbell} to="/train" variant="ghost">
                {t('weather_cta')}
              </ButtonLink>
            </div>
          </TimedEventCard>
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
      <div className={`${styles.cards} stagger`}>
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
        <Button icon={Swords} variant="ghost" onClick={() => setDuelOpen(true)}>
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

function PointsView() {
  const query = useRules();
  return (
    <QueryState query={query} failed="points_failed">
      {(rules) => (
        <>
          <PointsList rules={rules} embedded />
          <SportsCompare sessions={rules.sessions} embedded />
        </>
      )}
    </QueryState>
  );
}

/** Quests has three sections, each with its own address: this week, achievements, points. */
export function QuestsPage() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const badgesQuery = useBadges();
  const badges = badgesQuery.data;
  const unlocked = badges?.filter((b) => b.unlocked_at).length ?? 0;
  const view = pathname.endsWith('/achievements')
    ? 'achievements'
    : pathname.endsWith('/points')
      ? 'points'
      : 'quests';
  const heading = {
    quests: [t('quests_title'), t('quests_sub')],
    achievements: [t('badges_title'), t('badges_sub', { n: unlocked, t: badges?.length ?? 0 })],
    points: [t('nav_points'), t('points_sub')],
  }[view];
  return (
    <section aria-labelledby="page-title">
      <QuestsNav />
      <div className={styles.head}>
        <div>
          <h1 id="page-title">{heading[0]}</h1>
          <p className={styles.sub}>{heading[1]}</p>
        </div>
      </div>
      {view === 'quests' && <QuestsView />}
      {view === 'achievements' && (
        <QueryState query={badgesQuery} failed="badges_failed">
          {(data) => <Badges badges={data} />}
        </QueryState>
      )}
      {view === 'points' && <PointsView />}
    </section>
  );
}
