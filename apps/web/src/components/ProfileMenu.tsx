import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Link } from 'react-router';

import { useLogout } from '../api/auth';
import { useMe } from '../api/me';
import { SettingsSheet } from '../features/me/SettingsSheet';
import { useI18n } from '../i18n/context';
import { Avatar } from './Avatar';
import { useShareInvite } from './useShareInvite';
import styles from './ProfileMenu.module.css';

const ITEMS = '[role="menuitem"]';

/** The avatar's menu: who you are, your profile, settings and log out. */
export function ProfileMenu() {
  const { t } = useI18n();
  const me = useMe().data;
  const logout = useLogout();
  const shareInvite = useShareInvite();
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>(ITEMS)?.focus();
    const handlePointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointer);
    return () => document.removeEventListener('pointerdown', handlePointer);
  }, [open]);

  if (!me) return null;

  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };

  const handleKey = (event: ReactKeyboardEvent) => {
    const items = [...(menu.current?.querySelectorAll<HTMLElement>(ITEMS) ?? [])];
    const index = items.indexOf(document.activeElement as HTMLElement);
    const moves: Record<string, number> = {
      ArrowDown: (index + 1) % items.length,
      ArrowUp: (index - 1 + items.length) % items.length,
      Home: 0,
      End: items.length - 1,
    };
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'Tab') {
      setOpen(false);
    } else if (event.key in moves) {
      event.preventDefault();
      items[moves[event.key] ?? 0]?.focus();
    }
  };

  return (
    <div ref={root} className={styles.root} onKeyDown={open ? handleKey : undefined}>
      <button
        ref={trigger}
        type="button"
        className={styles.trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${t('profile')}, ${me.initials}`}
        onClick={() => setOpen((value) => !value)}
      >
        <Avatar initials={me.initials} color={me.color} size={44} />
      </button>
      {open && (
        <div ref={menu} className={styles.menu} role="menu" aria-label={t('profile')}>
          <div className={styles.who}>
            <Avatar initials={me.initials} color={me.color} size={40} />
            <span>
              <b>{me.display_name}</b>
              <small>{me.email}</small>
            </span>
          </div>
          <Link to="/me" role="menuitem" className={styles.item} onClick={() => setOpen(false)}>
            {t('menu_profile')}
          </Link>
          <button
            type="button"
            role="menuitem"
            className={styles.item}
            onClick={() => {
              setOpen(false);
              setSettingsOpen(true);
            }}
          >
            {t('settings')}
          </button>
          {shareInvite && (
            <button
              type="button"
              role="menuitem"
              className={styles.item}
              onClick={() => {
                setOpen(false);
                void shareInvite();
              }}
            >
              {t('invite_friends')}
            </button>
          )}
          {me.is_admin && (
            <Link
              to="/admin"
              role="menuitem"
              className={styles.item}
              onClick={() => setOpen(false)}
            >
              {t('admin_title')}
            </Link>
          )}
          <button
            type="button"
            role="menuitem"
            className={styles.item}
            disabled={logout.isPending}
            onClick={() => logout.mutate()}
          >
            {t('log_out')}
          </button>
        </div>
      )}
      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
