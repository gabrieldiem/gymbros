import { NavLink, useLocation } from 'react-router';

import { cx } from '../../components/cx';
import { CLIMB_SECTIONS } from '../../components/tabs';
import { useSlidingIndicator } from '../../components/useSlidingIndicator';
import { useI18n } from '../../i18n/context';
import styles from '../quests/QuestsNav.module.css';

/** Points or steps on mobile, sticky at the top, like the Quests sections. On desktop they are in
 * the side rail. */
export function ClimbNav() {
  const { t, lang } = useI18n();
  const { pathname } = useLocation();
  const nav = useSlidingIndicator<HTMLElement>('[aria-current="page"]', `${pathname}:${lang}`);
  return (
    <nav ref={nav} className={styles.nav} aria-label={t('climb_view')}>
      <span className={styles.thumb} aria-hidden="true" />
      {CLIMB_SECTIONS.map((section) => (
        <NavLink key={section.to} to={section.to} end className={cx(styles.link)}>
          <section.icon size={15} aria-hidden="true" />
          {t(section.label)}
        </NavLink>
      ))}
    </nav>
  );
}
