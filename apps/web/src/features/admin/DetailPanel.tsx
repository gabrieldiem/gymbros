import { ArrowLeft } from 'lucide-react';
import { useId, type ReactNode } from 'react';

import { Button } from '../../components/Button';
import { useI18n } from '../../i18n/context';
import styles from './Admin.module.css';

type Props = { title: string; onClose: () => void; children: ReactNode };

/** What's open, beside the list. On a phone it takes the whole screen, with a way back. */
export function DetailPanel({ title, onClose, children }: Props) {
  const { t } = useI18n();
  const titleId = useId();
  return (
    <section className={styles.panel} aria-labelledby={titleId}>
      <div className={styles.panelBack}>
        <Button type="button" variant="quiet" icon={ArrowLeft} onClick={onClose}>
          {t('admin_list_back')}
        </Button>
      </div>
      <h2 id={titleId}>{title}</h2>
      {children}
    </section>
  );
}
