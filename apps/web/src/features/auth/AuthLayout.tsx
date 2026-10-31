import { Outlet } from 'react-router';

import { Brand } from '../../components/Brand';
import { LanguageToggle } from '../../components/LanguageToggle';
import { useProfileLanguage } from '../../i18n/useLanguage';
import styles from './AuthLayout.module.css';

/** Narrow single-column layout for the screens before the tabs: no nav, just brand and language. */
export function AuthLayout() {
  useProfileLanguage();
  return (
    <div className={styles.layout}>
      <header className={styles.top}>
        <Brand />
        <LanguageToggle />
      </header>
      <main className={styles.content}>
        <Outlet />
      </main>
    </div>
  );
}
