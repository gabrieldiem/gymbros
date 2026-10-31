import { Brand } from './Brand';
import { LanguageToggle } from './LanguageToggle';
import styles from './TopBar.module.css';

export function TopBar() {
  return (
    <header className={styles.topbar}>
      <Brand className={styles.brand} />
      <div className={styles.actions}>
        <LanguageToggle />
      </div>
    </header>
  );
}
