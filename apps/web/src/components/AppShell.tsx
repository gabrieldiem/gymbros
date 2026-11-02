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
import { DESKTOP_RAIL } from './tabs';
import { TopBar } from './TopBar';
import { useMediaQuery } from './useMediaQuery';

export function AppShell() {
  useProfileLanguage();
  const desktop = useMediaQuery(DESKTOP_RAIL);
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
        {!desktop && (
          <footer className={styles.footer}>
            <HealthStatus />
          </footer>
        )}
      </main>
      <ActiveWorkoutBar />
      <NotificationToasts />
    </div>
  );
}
