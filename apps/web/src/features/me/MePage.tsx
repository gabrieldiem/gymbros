import { useLogout } from '../../api/auth';
import { Button } from '../../components/Button';
import { PlaceholderPage } from '../../components/PlaceholderPage';
import { useI18n } from '../../i18n/context';
import styles from './MePage.module.css';

export function MePage() {
  const { t } = useI18n();
  const logout = useLogout();
  return (
    <>
      <PlaceholderPage title="me_title" sub="me_sub" />
      <div className={styles.actions}>
        <Button variant="ghost" onClick={() => logout.mutate()} disabled={logout.isPending}>
          {t('log_out')}
        </Button>
      </div>
    </>
  );
}
