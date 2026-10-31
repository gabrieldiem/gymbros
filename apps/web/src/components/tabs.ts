import type { MessageKey } from '../i18n/en';
import type { IconName } from './Icon';

export type Tab = { to: string; icon: IconName; label: MessageKey; primary?: boolean };

/** The five tabs, in nav order. Train is the primary action (raised centre button on mobile). */
export const TABS: readonly Tab[] = [
  { to: '/climb', icon: 'climb', label: 'nav_climb' },
  { to: '/crew', icon: 'crew', label: 'nav_crew' },
  { to: '/train', icon: 'plus', label: 'nav_train', primary: true },
  { to: '/quests', icon: 'flag', label: 'nav_quests' },
  { to: '/me', icon: 'bars', label: 'nav_you' },
];
