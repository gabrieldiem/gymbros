import { Play, RotateCw } from 'lucide-react';
import { useMemo, useState } from 'react';

import type { Standing } from '../../api/climb';
import type { SampleSession } from '../../api/rules';
import { Button } from '../../components/Button';
import { CountUp } from '../../components/CountUp';
import { useI18n } from '../../i18n/context';
import { RopeOrder } from '../climb/RopeOrder';
import { TrailMap } from '../climb/TrailMap';
import { lineItemText } from '../train/format';
import styles from './LandingPage.module.css';
import {
  rankSample,
  SAMPLE_CAMP_STEP,
  SAMPLE_SUMMIT,
  SAMPLE_WEEKLY_TARGET,
  SAMPLE_YOU,
} from './sampleCrew';

const namesAbove = (standings: Standing[]) => {
  const you = standings.findIndex((s) => s.user_id === SAMPLE_YOU);
  return standings.slice(0, you).map((s) => s.display_name);
};

/** The live part of the landing page: finish a sample workout and watch the rope change. */
export function ClimbDemo({
  session,
  map,
}: {
  session: SampleSession | undefined;
  map: (trail: React.ReactNode) => React.ReactNode;
}) {
  const { t, n } = useI18n();
  const [finished, setFinished] = useState(0);
  const gained = finished * (session?.total ?? 0);
  const standings = useMemo(() => rankSample(gained, finished), [gained, finished]);
  const above = namesAbove(standings);
  const passed = useMemo(() => {
    if (!finished) return [];
    const before = namesAbove(rankSample(gained - (session?.total ?? 0), finished - 1));
    return before.filter((name) => !above.includes(name));
  }, [finished, gained, session, above]);
  const you = standings.find((s) => s.user_id === SAMPLE_YOU);
  const atSummit = (you?.points ?? 0) >= SAMPLE_SUMMIT;

  const status = passed.length
    ? t('landing_demo_passed', { name: passed.join(t('and')) })
    : above.length === 0
      ? t('landing_demo_lead')
      : t('landing_demo_gap', {
          n: n((standings[(you?.position ?? 1) - 2]?.points ?? 0) - (you?.points ?? 0)),
          name: above[above.length - 1] ?? '',
        });

  return (
    <>
      {map(<TrailMap standings={standings} summit={SAMPLE_SUMMIT} campStep={SAMPLE_CAMP_STEP} />)}
      <section className={styles.demo} aria-labelledby="demo-title">
        <h2 id="demo-title">{t('landing_demo_title')}</h2>
        <p className={styles.muted}>{t('landing_demo_sub')}</p>
        <Button
          icon={finished ? RotateCw : Play}
          wide
          disabled={!session || atSummit}
          onClick={() => setFinished((count) => count + 1)}
        >
          {finished ? t('landing_demo_again') : t('landing_demo_finish')}
        </Button>
        <p className={styles.demoStatus} role="status">
          {finished > 0 && status}
        </p>
        {finished > 0 && session && (
          <div className={styles.receipt} key={finished}>
            <ul>
              {session.line_items.map((item, i) => (
                <li key={item.key} style={{ animationDelay: `${i * 90}ms` }}>
                  <span>{lineItemText(item, [], t, n)}</span>
                  <b>+{n(item.points)}</b>
                </li>
              ))}
            </ul>
            <p className={styles.receiptTotal}>
              <span>{t('landing_demo_total')}</span>
              <b>
                +<CountUp value={session.total} format={n} durationMs={700} />
              </b>
            </p>
          </div>
        )}
        <RopeOrder standings={standings} target={SAMPLE_WEEKLY_TARGET} />
      </section>
    </>
  );
}
