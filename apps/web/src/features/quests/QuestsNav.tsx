import { NavLink, useLocation } from 'react-router';

import { useBadges } from '../../api/compete';
import { cx } from '../../components/cx';
import { QUEST_SECTIONS } from '../../components/tabs';
import { useSlidingIndicator } from '../../components/useSlidingIndicator';
import { useI18n } from '../../i18n/context';
import styles from './QuestsNav.module.css';

/** The Quests sections on mobile, sticky at the top. On desktop they are in the side rail. */
export function QuestsNav() {
  const { t, lang } = useI18n();
  const { pathname } = useLocation();
  const badges = useBadges().data;
  const unlocked = badges?.filter((b) => b.unlocked_at).length ?? 0;
  const nav = useSlidingIndicator<HTMLElement>(
    '[aria-current="page"]',
    `${pathname}:${lang}:${badges?.length ?? 0}`,
  );
  return (
    <nav ref={nav} className={styles.nav} aria-label={t('quests_view')}>
      <span className={styles.thumb} aria-hidden="true" />
      {QUEST_SECTIONS.map((section) => (
        <NavLink key={section.to} to={section.to} end className={cx(styles.link)}>
          {t(section.label)}{' '}
          {section.to === '/quests/achievements' && badges && (
            <small className={styles.count}>
              {unlocked}/{badges.length}
            </small>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
