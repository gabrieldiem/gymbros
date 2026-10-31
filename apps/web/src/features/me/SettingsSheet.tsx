import { useLogout } from '../../api/auth';
import { useMe, useUpdateMe } from '../../api/me';
import { Button } from '../../components/Button';
import { LanguageToggle } from '../../components/LanguageToggle';
import { Segmented } from '../../components/Segmented';
import { Sheet } from '../../components/Sheet';
import { useI18n } from '../../i18n/context';
import styles from './Me.module.css';

const REST_OPTIONS = ['60', '90', '120', '180'] as const;

/** Language, rest timer length and log out. */
export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const me = useMe().data;
  const updateMe = useUpdateMe();
  const logout = useLogout();
  return (
    <Sheet title={t('settings')} onClose={onClose}>
      <div className={styles.settings}>
        <div>
          <h3>{t('language')}</h3>
          <p>{t('language_hint')}</p>
          <LanguageToggle />
        </div>
        <div>
          <h3>{t('rest_set')}</h3>
          <p>{t('rest_hint')}</p>
          <Segmented
            label={t('rest_set')}
            value={String(me?.rest_seconds ?? 90)}
            onChange={(value) => updateMe.mutate({ rest_seconds: Number(value) })}
            options={REST_OPTIONS.map((s) => ({
              value: s,
              label: t('seconds_n', { n: Number(s) }),
            }))}
          />
        </div>
        <Button variant="ghost" wide onClick={() => logout.mutate()} disabled={logout.isPending}>
          {t('log_out')}
        </Button>
      </div>
    </Sheet>
  );
}
