import { Link } from 'react-router';

import { useMe } from '../api/me';
import { useI18n } from '../i18n/context';
import { Avatar } from './Avatar';
import { Brand } from './Brand';
import { LanguageToggle } from './LanguageToggle';
import styles from './TopBar.module.css';

export function TopBar() {
  const { t } = useI18n();
  const me = useMe().data;
  return (
    <header className={styles.topbar}>
      <Brand className={styles.brand} />
      <div className={styles.actions}>
        <LanguageToggle />
        {me && (
          <Link to="/me" className={styles.me} aria-label={t('profile')}>
            <Avatar initials={me.initials} color={me.color} size={44} />
          </Link>
        )}
      </div>
    </header>
  );
}
