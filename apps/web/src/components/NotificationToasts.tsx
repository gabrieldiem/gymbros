import { useEffect, useRef } from 'react';

import { useInbox } from '../api/social';
import { notificationText } from '../features/crew/format';
import { useI18n } from '../i18n/context';
import { useToast } from './toast';

/** Toast the newest notification that arrived since the last poll (not the ones at startup). */
export function NotificationToasts() {
  const { t } = useI18n();
  const showToast = useToast();
  const items = useInbox().data?.items;
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!items) return;
    if (seen.current === null) {
      seen.current = new Set(items.map((n) => n.id));
      return;
    }
    const fresh = items.filter((n) => !n.read && !seen.current?.has(n.id));
    items.forEach((n) => seen.current?.add(n.id));
    const newest = fresh[0];
    if (newest) showToast(notificationText(newest, t), { alert: newest.key === 'n_passed' });
  }, [items, showToast, t]);

  return null;
}
