import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { useClimb, type ClimbChange, type ClimbMode } from '../../api/climb';
import { useMe } from '../../api/me';
import { useActiveWorkout, useCatalog } from '../../api/train';
import { RecapStories } from '../recap/RecapStories';
import { Button } from '../../components/Button';
import { LoadingBlock } from '../../components/QueryState';
import { Segmented } from '../../components/Segmented';
import { useToast } from '../../components/toast';
import { useI18n } from '../../i18n/context';
import type { MessageKey } from '../../i18n/en';
import styles from './ClimbPage.module.css';
import { RopeOrder } from './RopeOrder';
import { StandingPanel } from './StandingPanel';
import { TrailMap } from './TrailMap';
import { TrainingNow } from './TrainingNow';

type ClimbState = { climb?: ClimbChange } | null;

function useClimbMessage() {
  const { t, n } = useI18n();
  return (change: ClimbChange) => {
    const gained = n(change.points_after - change.points_before);
    const message = change.passed.length
      ? t('climbed_pass', { n: gained, names: change.passed.join(t('and')) })
      : t('climbed', { n: gained });
    if (change.camp_after <= change.camp_before) return message;
    return `${t('rank_up', { rank: t(`rank_${change.camp_after}` as MessageKey) })} ${message}`;
  };
}

export function ClimbPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const showToast = useToast();
  const climbMessage = useClimbMessage();
  const [mode, setMode] = useState<ClimbMode>('all');
  const climb = useClimb(mode);
  const me = useMe().data;
  const training = Boolean(useActiveWorkout().data);
  const catalog = useCatalog().data;
  const legEvent = catalog?.weekly_event === 'leg_day_x2';
  const [recapOpen, setRecapOpen] = useState(false);
  const change = (location.state as ClimbState)?.climb;

  const handleClimbDone = () => {
    if (!change) return;
    showToast(climbMessage(change));
    navigate(location.pathname, { replace: true, state: null });
  };

  return (
    <>
      <section className={styles.hero} aria-labelledby="page-title">
        <h1 id="page-title">
          <span>{t('hero1')}</span>
          <span className={styles.volt}>{t('hero2')}</span>
        </h1>
        <p>{t('hero_sub')}</p>
        <div className={styles.row}>
          <div>{legEvent && <span className={styles.chip}>{t('leg_event_name')}</span>}</div>
          <Segmented
            label={t('mode_label')}
            value={mode}
            onChange={setMode}
            options={[
              { value: 'all', label: t('mode_all') },
              { value: 'week', label: t('mode_week') },
            ]}
          />
        </div>
      </section>
      {climb.data ? (
        <div className={styles.grid}>
          <TrailMap
            key={mode}
            standings={climb.data.standings}
            summit={climb.data.summit}
            campStep={climb.data.camp_step}
            climbFrom={
              change && mode === 'all'
                ? Math.min(1, change.points_before / climb.data.summit)
                : undefined
            }
            onClimbDone={handleClimbDone}
          />
          <aside>
            {me && (
              <StandingPanel
                climb={climb.data}
                myAvatar={{ initials: me.initials, color: me.color }}
                training={training}
                onRecap={() => setRecapOpen(true)}
              />
            )}
            <TrainingNow myId={me?.id} />
            <div className={styles.rope}>
              <RopeOrder standings={climb.data.standings} target={climb.data.weekly_target} />
            </div>
          </aside>
        </div>
      ) : climb.isError ? (
        <div className={styles.error} role="alert">
          <p>{t('climb_failed')}</p>
          <Button variant="ghost" onClick={() => void climb.refetch()}>
            {t('retry')}
          </Button>
        </div>
      ) : (
        <LoadingBlock rows={2} />
      )}
      {recapOpen && (
        <RecapStories exercises={catalog?.exercises ?? []} onClose={() => setRecapOpen(false)} />
      )}
    </>
  );
}
