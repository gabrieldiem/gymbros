import { MailX } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';

import { apiRequest } from '../../api/client';
import { Button } from '../../components/Button';
import { useI18n } from '../../i18n/context';

/**
 * Where the link in an email lands. It asks first, because mail apps open links on their own to
 * check them, and that alone mustn't unsubscribe anyone.
 */
export function UnsubscribePage() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const stop = useMutation({
    mutationFn: () =>
      apiRequest<null>(
        `/email/unsubscribe?u=${encodeURIComponent(params.get('u') ?? '')}&t=${encodeURIComponent(params.get('t') ?? '')}`,
        { method: 'POST' },
      ),
  });
  return (
    <section aria-labelledby="page-title">
      <h1 id="page-title">{t('unsubscribe_title')}</h1>
      {stop.isSuccess ? (
        <p role="status">{t('unsubscribe_done')}</p>
      ) : (
        <>
          <p>{t('unsubscribe_hint')}</p>
          <p style={{ marginTop: 16 }}>
            <Button icon={MailX} disabled={stop.isPending} onClick={() => stop.mutate()}>
              {t('unsubscribe_cta')}
            </Button>
          </p>
          {stop.isError && <p role="alert">{t('unsubscribe_failed')}</p>}
        </>
      )}
    </section>
  );
}
