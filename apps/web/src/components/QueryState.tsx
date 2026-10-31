import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { useI18n } from '../i18n/context';
import type { MessageKey } from '../i18n/en';
import { Button } from './Button';
import styles from './QueryState.module.css';

/** Placeholder blocks while data loads, announced to screen readers. */
export function LoadingBlock({ rows = 3 }: { rows?: number }) {
  const { t } = useI18n();
  return (
    <div className={styles.skeleton} role="status" aria-live="polite">
      <span className="sr-only">{t('loading')}</span>
      {Array.from({ length: rows }, (_, i) => (
        <i key={i} aria-hidden="true" />
      ))}
    </div>
  );
}

/** What failed, and a retry. */
export function ErrorBlock({ message, onRetry }: { message: MessageKey; onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <div className={styles.error} role="alert">
      <p>{t(message)}</p>
      <Button variant="ghost" onClick={onRetry}>
        {t('retry')}
      </Button>
    </div>
  );
}

type Props<T> = {
  query: UseQueryResult<T>;
  failed: MessageKey;
  rows?: number;
  children: (data: T) => ReactNode;
};

/** Loading → skeleton, error without data → retry, otherwise render the data (stale data stays). */
export function QueryState<T>({ query, failed, rows, children }: Props<T>) {
  if (query.data !== undefined) return <>{children(query.data)}</>;
  if (query.isError) return <ErrorBlock message={failed} onRetry={() => void query.refetch()} />;
  return <LoadingBlock rows={rows ?? 3} />;
}
