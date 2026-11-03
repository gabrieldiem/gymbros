import { NavLink, useLocation } from 'react-router';

import { useActiveWorkout } from '../api/train';
import { useI18n } from '../i18n/context';
import { Brand } from './Brand';
import { cx } from './cx';
import { HealthStatus } from './HealthStatus';
import { Icon } from './Icon';
import styles from './NavRail.module.css';
import { CLIMB_SECTIONS, DESKTOP_RAIL, QUEST_SECTIONS, TABS } from './tabs';
import { useMediaQuery } from './useMediaQuery';
import { useShareInvite } from './useShareInvite';
import { useSlidingIndicator } from './useSlidingIndicator';

function linkClass(primary: boolean | undefined): string {
  return cx(styles.link, primary && styles.train);
}

/** A floating dock on mobile and a side rail on desktop, with an indicator that slides between
 * tabs. Train has its own raised button, so the indicator hides there. */
export function NavRail() {
  const { t, lang } = useI18n();
  const { pathname } = useLocation();
  const training = Boolean(useActiveWorkout().data);
  const shareInvite = useShareInvite();
  const desktop = useMediaQuery(DESKTOP_RAIL);
  const nav = useSlidingIndicator<HTMLElement>(
    '[data-tab][aria-current="page"]:not([data-primary])',
    `${pathname}:${lang}`,
  );
  return (
    <nav ref={nav} className={styles.rail} aria-label={t('nav_main')}>
      <span className={styles.indicator} aria-hidden="true" />
      <div className={styles.head}>
        <Brand size={34} />
        <p className={styles.tagline}>{t('tagline')}</p>
      </div>
      {TABS.map((tab) => (
        <div key={tab.to} className={cx(styles.item, tab.primary && styles.trainItem)}>
          <NavLink
            to={tab.to}
            className={linkClass(tab.primary)}
            data-tab=""
            data-primary={tab.primary ? '' : undefined}
          >
            {tab.primary ? (
              <span className={styles.disc}>
                <Icon name={tab.icon} size={30} strokeWidth={2.8} />
              </span>
            ) : (
              <Icon name={tab.icon} />
            )}
            <span className={styles.label}>{t(tab.label)}</span>
            {tab.primary && training && (
              <span className={styles.liveDot} role="img" aria-label={t('training_now')} />
            )}
          </NavLink>
          {(tab.to === '/climb' || tab.to === '/quests') && (
            <div className={styles.subs}>
              {(tab.to === '/climb' ? CLIMB_SECTIONS : QUEST_SECTIONS).map((section) => (
                <NavLink key={section.to} to={section.to} end className={cx(styles.sub)}>
                  <section.icon size={15} aria-hidden="true" />
                  {t(section.label)}
                </NavLink>
              ))}
            </div>
          )}
        </div>
      ))}
      {shareInvite && (
        <button type="button" className={styles.invite} onClick={() => void shareInvite()}>
          <Icon name="crew" size={20} />
          {t('invite_friends')}
        </button>
      )}
      {desktop && (
        <div className={styles.status}>
          <HealthStatus />
        </div>
      )}
    </nav>
  );
}
