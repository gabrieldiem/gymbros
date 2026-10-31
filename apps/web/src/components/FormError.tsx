import { errorMessageKey } from '../api/errors';
import { useI18n } from '../i18n/context';
import styles from './FormError.module.css';

/** The copy for a failed mutation, announced to screen readers. Renders nothing without one. */
export function FormError({ error }: { error: unknown }) {
  const { t } = useI18n();
  if (!error) return null;
  return (
    <p className={styles.error} role="alert">
      {t(errorMessageKey(error))}
    </p>
  );
}
