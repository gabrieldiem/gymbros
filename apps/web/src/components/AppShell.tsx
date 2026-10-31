import { Outlet } from 'react-router';

import { useProfileLanguage } from '../i18n/useLanguage';
import { ActiveWorkoutBar } from './ActiveWorkoutBar';
import styles from './AppShell.module.css';
import { HealthStatus } from './HealthStatus';
import { InstallBanner } from './InstallBanner';
import { NavRail } from './NavRail';
import { NotificationToasts } from './NotificationToasts';
import { TopBar } from './TopBar';

export function AppShell() {
  useProfileLanguage();
  return (
    <div className={styles.app}>
      <NavRail />
      <main className={styles.main}>
        <TopBar />
        <InstallBanner />
        <Outlet />
        <footer className={styles.footer}>
          <HealthStatus />
        </footer>
      </main>
      <ActiveWorkoutBar />
      <NotificationToasts />
    </div>
  );
}
