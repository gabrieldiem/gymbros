import { NavLink } from 'react-router';

import { useActiveWorkout } from '../api/train';
import { useI18n } from '../i18n/context';
import { Brand } from './Brand';
import { cx } from './cx';
import { Icon } from './Icon';
import styles from './NavRail.module.css';
import { TABS } from './tabs';

function linkClass(primary: boolean | undefined): string {
  return cx(styles.link, primary && styles.train);
}

export function NavRail() {
  const { t } = useI18n();
  const training = Boolean(useActiveWorkout().data);
  return (
    <nav className={styles.rail} aria-label={t('nav_main')}>
      <div className={styles.head}>
        <Brand size={34} />
        <p className={styles.tagline}>{t('tagline')}</p>
      </div>
      {TABS.map((tab) => (
        <NavLink key={tab.to} to={tab.to} className={linkClass(tab.primary)}>
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
      ))}
    </nav>
  );
}
