import { Outlet } from 'react-router';

import styles from './AppShell.module.css';
import { HealthStatus } from './HealthStatus';
import { NavRail } from './NavRail';
import { TopBar } from './TopBar';

export function AppShell() {
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
    </div>
  );
}
