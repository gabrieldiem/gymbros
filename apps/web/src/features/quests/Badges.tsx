import { useState } from 'react';

import type { Badge } from '../../api/compete';
import { BadgePatch } from '../../components/BadgePatch';
import { Button } from '../../components/Button';
import { cx } from '../../components/cx';
import { Sheet } from '../../components/Sheet';
import { useI18n } from '../../i18n/context';
import type { MessageKey } from '../../i18n/en';
import styles from './Quests.module.css';

function progressText(badge: Badge, n: (v: number) => string): string {
  return `${n(badge.progress)} / ${n(badge.goal)}`;
}

/** The 15 badges: patches, progress, and a detail sheet. */
export function Badges({ badges }: { badges: Badge[] }) {
  const { t, n } = useI18n();
  const [open, setOpen] = useState<Badge | null>(null);
  const name = (b: Badge) => t(`badge_${b.id}` as MessageKey);
  return (
    <>
      <div className={styles.badges}>
        {badges.map((b) => (
          <button
            key={b.id}
            type="button"
            className={cx(styles.badge, !b.unlocked_at && styles.locked)}
            aria-label={`${name(b)}, ${b.unlocked_at ? t('unlocked') : t('locked')}`}
            onClick={() => setOpen(b)}
          >
            <BadgePatch icon={b.icon} color={b.color} locked={!b.unlocked_at} />
            <b>{name(b)}</b>
            <span>{b.unlocked_at ? `+${n(b.points)}` : progressText(b, n)}</span>
          </button>
        ))}
      </div>
      {open && (
        <Sheet title={name(open)} onClose={() => setOpen(null)}>
          <div className={styles.centered}>
            <BadgePatch icon={open.icon} color={open.color} locked={!open.unlocked_at} size={140} />
            <p className={styles.muted}>{t(`badge_${open.id}_d` as MessageKey)}</p>
          </div>
          <ul className={styles.kv}>
            <li>
              <span>{t('progress')}</span>
              <span>{open.unlocked_at ? t('unlocked') : progressText(open, n)}</span>
            </li>
            <li>
              <span>{t('reward')}</span>
              <span>{t('reward_val', { n: open.points })}</span>
            </li>
            <li>
              <span>{t('in_crew')}</span>
              <span>{t('have_it', { n: open.crew_count })}</span>
            </li>
          </ul>
          <Button variant="quiet" wide onClick={() => setOpen(null)}>
            {t('close')}
          </Button>
        </Sheet>
      )}
    </>
  );
}
