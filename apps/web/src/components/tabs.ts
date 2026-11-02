import type { MessageKey } from '../i18n/en';
import type { IconName } from './Icon';

export type Tab = { to: string; icon: IconName; label: MessageKey; primary?: boolean };

/** Inside Quests: what stays useful every week. Deep links, so the nav can go straight to them. */
export const QUEST_SECTIONS: readonly { to: string; label: MessageKey }[] = [
  { to: '/quests', label: 'nav_weekly' },
  { to: '/quests/achievements', label: 'nav_achievements' },
  { to: '/quests/points', label: 'nav_points' },
];

/** The five tabs, in nav order. Train is the primary action (raised centre button on mobile). */
export const TABS: readonly Tab[] = [
  { to: '/climb', icon: 'climb', label: 'nav_climb' },
  { to: '/crew', icon: 'crew', label: 'nav_crew' },
  { to: '/train', icon: 'plus', label: 'nav_train', primary: true },
  { to: '/quests', icon: 'flag', label: 'nav_quests' },
  { to: '/me', icon: 'bars', label: 'nav_you' },
];

/** From this width the dock becomes a side rail (NavRail.module.css). */
export const DESKTOP_RAIL = '(min-width: 960px)';
