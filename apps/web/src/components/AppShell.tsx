import { Outlet } from 'react-router';

import { useProfileLanguage } from '../i18n/useLanguage';
import { ActiveWorkoutBar } from './ActiveWorkoutBar';
import { AnimatedPage } from './AnimatedPage';
import styles from './AppShell.module.css';
import { HealthStatus } from './HealthStatus';
import { InstallBanner } from './InstallBanner';
import { UpdateBanner } from './UpdateBanner';
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
        <UpdateBanner />
        <InstallBanner />
        <AnimatedPage>
          <Outlet />
        </AnimatedPage>
        <footer className={styles.footer}>
          <HealthStatus />
        </footer>
      </main>
      <ActiveWorkoutBar />
      <NotificationToasts />
    </div>
  );
}
