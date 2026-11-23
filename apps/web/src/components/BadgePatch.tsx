import { BADGE_ICONS } from './badgeIcons';

type Props = {
  icon: string;
  color: string;
  locked: boolean;
  size?: number;
  /** The hard tier: drawn with a second, inner outline. */
  elite?: boolean | undefined;
};

/** A badge as a hexagon patch in its colour; locked badges are greyed. Icons from the prototype. */
export function BadgePatch({ icon, color, locked, size = 72, elite = false }: Props) {
  const tone = locked ? '#5A5A57' : color;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path
        d="M24 3 42 13.5v21L24 45 6 34.5v-21z"
        fill={locked ? '#1F1F1F' : `${color}22`}
        stroke={tone}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {elite && (
        <path
          d="M24 7.6 38.2 15.8v16.4L24 40.4 9.8 32.2V15.8z"
          fill="none"
          stroke={tone}
          strokeWidth="1.2"
          strokeLinejoin="round"
          opacity="0.8"
        />
      )}
      <g
        transform="translate(12 12)"
        fill="none"
        stroke={tone}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={BADGE_ICONS[icon] ?? BADGE_ICONS.star} />
      </g>
    </svg>
  );
}
