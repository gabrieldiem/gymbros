import { useState } from 'react';
import { useNavigate } from 'react-router';

import { useInbox, useMarkInboxRead, type Notification } from '../api/social';
import { notificationText } from '../features/crew/format';
import { useI18n } from '../i18n/context';
import { timeAgo } from '../i18n/timeAgo';
import { Avatar } from './Avatar';
import { cx } from './cx';
import styles from './NotificationBell.module.css';
import { Sheet } from './Sheet';

function BellIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 10a6 6 0 0 1 12 0c0 5 2 6.5 2 6.5H4S6 15 6 10z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  );
}

/** Bell with the unread count; opens the inbox and marks everything read. */
export function NotificationBell() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const inbox = useInbox();
  const markRead = useMarkInboxRead();
  const [open, setOpen] = useState(false);
  const unread = inbox.data?.unread ?? 0;

  const handleOpen = () => {
    setOpen(true);
    if (unread) markRead.mutate();
  };
  const handleGo = (item: Notification) => {
    setOpen(false);
    navigate(item.link);
  };

  return (
    <>
      <button
        type="button"
        className={styles.bell}
        aria-label={unread ? t('alerts_n', { n: unread }) : t('alerts')}
        onClick={handleOpen}
      >
        <BellIcon />
        {unread > 0 && (
          <span className={styles.count} aria-hidden="true">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <Sheet title={t('alerts')} onClose={() => setOpen(false)}>
          {inbox.data?.items.length ? (
            <ul className={styles.inbox}>
              {inbox.data.items.map((item) => (
                <li key={item.id} className={cx(!item.read && styles.unread)}>
                  <button type="button" onClick={() => handleGo(item)}>
                    {item.actor && (
                      <Avatar initials={item.actor.initials} color={item.actor.color} size={36} />
                    )}
                    <p>
                      {!item.read && <span className={styles.dot} aria-hidden="true" />}
                      {notificationText(item, t)}
                      <span className={styles.time}>{timeAgo(lang, item.created_at)}</span>
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.empty}>{t('inbox_empty')}</p>
          )}
        </Sheet>
      )}
    </>
  );
}
