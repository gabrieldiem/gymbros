import { Outlet } from 'react-router';

import { useProfileLanguage } from '../i18n/useLanguage';
import { ActiveWorkoutBar } from './ActiveWorkoutBar';
import styles from './AppShell.module.css';
import { HealthStatus } from './HealthStatus';
import { NavRail } from './NavRail';
import { TopBar } from './TopBar';

export function AppShell() {
  useProfileLanguage();
  return (
    <div className={styles.app}>
      <NavRail />
      <main className={styles.main}>
        <TopBar />
        <Outlet />
        <footer className={styles.footer}>
          <HealthStatus />
        </footer>
      </main>
      <ActiveWorkoutBar />
    </div>
  );
}
