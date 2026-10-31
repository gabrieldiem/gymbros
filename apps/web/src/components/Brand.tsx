import { Link } from 'react-router';

import { useI18n } from '../i18n/context';
import styles from './Brand.module.css';
import { cx } from './cx';
import { Logo } from './Logo';

type Props = { size?: number; className?: string | undefined };

export function Brand({ size = 30, className }: Props) {
  const { t } = useI18n();
  return (
    <Link to="/climb" className={cx(styles.brand, className)} aria-label={t('brand')}>
      <Logo size={size} />
      <b aria-hidden="true">{t('brand')}</b>
    </Link>
  );
}
