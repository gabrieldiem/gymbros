import { useMe } from '../api/me';
import { Brand } from './Brand';
import { LanguageToggle } from './LanguageToggle';
import { NotificationBell } from './NotificationBell';
import { ProfileMenu } from './ProfileMenu';
import styles from './TopBar.module.css';

export function TopBar() {
  const me = useMe().data;
  return (
    <header className={styles.topbar}>
      <Brand className={styles.brand} />
      <div className={styles.actions}>
        {/* Signed in, the language lives in the profile menu and settings. */}
        {!me && <LanguageToggle />}
        {me && <NotificationBell />}
        {me && <ProfileMenu />}
      </div>
    </header>
  );
}
