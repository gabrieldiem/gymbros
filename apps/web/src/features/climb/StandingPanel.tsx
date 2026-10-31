import type { Climb } from '../../api/climb';
import { Avatar } from '../../components/Avatar';
import { ButtonLink } from '../../components/Button';
import { cx } from '../../components/cx';
import { Pips } from '../../components/Pips';
import { useI18n } from '../../i18n/context';
import type { MessageKey } from '../../i18n/en';
import { ordinal, ordinalParts } from '../../i18n/ordinal';
import { goalText } from '../train/goalText';
import styles from './StandingPanel.module.css';

type Props = {
  climb: Climb;
  myAvatar: { initials: string; color: Climb['standings'][0]['color'] };
  training: boolean;
  onRecap: () => void;
};

const signed = (value: number) => (value > 0 ? '+' : value < 0 ? '−' : '±') + Math.abs(value);

function VsCell({ value, suffix, label }: { value: number | null; suffix: string; label: string }) {
  const { t } = useI18n();
  return (
    <div>
      <b
        className={cx(value !== null && value < 0 && styles.down)}
        title={value === null ? t('vs_none') : undefined}
      >
        {value === null ? '–' : `${signed(value)}${suffix}`}
      </b>
      <span>{label}</span>
    </div>
  );
}

/** Your standing: position, points, camp, goal pips, gaps, next camp and you vs 4 weeks ago. */
export function StandingPanel({ climb, myAvatar, training, onRecap }: Props) {
  const { t, n, lang } = useI18n();
  const { me, improvement } = climb;
  const [num, suffix] = ordinalParts(lang, me.position);
  const gapAbove = me.above && t('to_catch', { n: n(me.above.gap), name: me.above.display_name });
  const gapBelow =
    me.below &&
    t(me.below.training_now ? 'ahead_training' : 'ahead_of', {
      n: n(me.below.gap),
      name: me.below.display_name,
    });
  const next = me.next_camp
    ? t('next_rank', {
        rank: t(`rank_${me.next_camp.camp}` as MessageKey),
        n: n(me.next_camp.points_needed),
      })
    : t('top_rank');

  return (
    <section className={styles.panel} aria-label={t('position', { n: ordinal(lang, me.position) })}>
      <div className={styles.standing}>
        <div className={styles.rank} aria-hidden="true">
          {num}
          <sup>{suffix}</sup>
        </div>
        <div>
          <p className={styles.pts}>{t('pts_n', { n: n(me.points) })}</p>
          <span className={styles.camp}>{t(`rank_${me.camp}` as MessageKey)}</span>
        </div>
      </div>
      <p className={styles.goal}>
        <Pips done={me.workouts_this_week} target={climb.weekly_target} large />
        <span>{goalText(t, me.workouts_this_week, climb.weekly_target)}</span>
      </p>
      <ul className={styles.gaps}>
        <li>
          {me.above ? (
            <>
              <Avatar initials={me.above.initials} color={me.above.color} size={28} />
              <span>{gapAbove}</span>
            </>
          ) : (
            <>
              <Avatar initials={myAvatar.initials} color={myAvatar.color} size={28} />
              <span>{t('you_lead')}</span>
            </>
          )}
        </li>
        {me.below && (
          <li>
            <Avatar initials={me.below.initials} color={me.below.color} size={28} />
            <span>{gapBelow}</span>
          </li>
        )}
        <li>
          <span className={styles.peak} aria-hidden="true">
            ▲
          </span>
          <span>{next}</span>
        </li>
      </ul>
      <ButtonLink to="/train" wide>
        {training ? t('back_workout') : t('start_training')}
      </ButtonLink>
      <p className={styles.vsTitle}>{t('vs_title')}</p>
      <div className={styles.vs}>
        <VsCell value={improvement.strength_pct} suffix="%" label={t('vs_strength')} />
        <VsCell value={improvement.volume_pct} suffix="%" label={t('vs_volume')} />
        <VsCell value={improvement.workouts_change} suffix="" label={t('vs_workouts')} />
      </div>
      <p className={styles.note}>{t('vs_note')}</p>
      <button type="button" className={styles.recap} onClick={onRecap}>
        <b>{t('recap_title')}</b>
        <span>{t('recap_sub')}</span>
      </button>
    </section>
  );
}
