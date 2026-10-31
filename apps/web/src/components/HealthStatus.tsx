import { useHealth } from '../api/health';
import { useI18n } from '../i18n/context';
import type { MessageKey } from '../i18n/en';
import { cx } from './cx';
import styles from './HealthStatus.module.css';

type State = 'checking' | 'up' | 'down';

const LABELS: Record<State, MessageKey> = {
  checking: 'api_checking',
  up: 'api_up',
  down: 'api_down',
};

/** Server reachability, from `/api/health`. */
export function HealthStatus() {
  const { t } = useI18n();
  const health = useHealth();
  const state: State = health.isPending
    ? 'checking'
    : health.data?.database === 'up'
      ? 'up'
      : 'down';
  return (
    <p className={cx(styles.status, styles[state])} role="status" data-state={state}>
      <span className={styles.dot} aria-hidden="true" />
      {t(LABELS[state])}
    </p>
  );
}
