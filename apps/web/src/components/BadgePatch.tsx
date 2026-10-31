/** A badge as a hexagon patch in its colour; locked badges are greyed. Icons from the prototype. */
const ICONS: Record<string, string> = {
  boot: 'M7 4h5v8l6 2c1.5.5 2 1.5 2 3v2H6z M6 15.5h14',
  up: 'M4 18 10 12l4 4 6-8 M15 8h5v5',
  barbell: 'M2 12h20M5 8.5v7M8 6.5v11M16 6.5v11M19 8.5v7',
  kettle: 'M9 7.5a3 3 0 0 1 6 0 M7.5 9.5h9l1.5 10H6z',
  flame: 'M12 3c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-4.5 2-7 2 1 3 3 3 5 1-2 1-6 1-9z',
  plate: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18 M12 7a5 5 0 1 0 0 10a5 5 0 1 0 0-10',
  sun: 'M3 17.5h18M7 17.5a5 5 0 0 1 10 0M12 6v3M5.5 9.5l2 2M18.5 9.5l-2 2',
  bolt: 'M13 2 5 14h6l-1 8 8-12h-6z',
  rope: 'M7.4 14.8 10.6 9.7M13.4 9.7l3.2 5.1M8.5 17h7 M12 5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5',
  star: 'm12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
  chat: 'M4 5h16v11H9l-5 4z M8 9.5h8M8 12.5h5',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
  loop: 'M20 12a8 8 0 1 1-2.4-5.7 M20 4v5h-5',
  peak: 'M2 20 9 8l4 6 3-4 6 10z M9 8V3l4 1.5L9 6',
  target: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18 M12 12 21 3M17 3h4v4',
};

type Props = { icon: string; color: string; locked: boolean; size?: number };

export function BadgePatch({ icon, color, locked, size = 72 }: Props) {
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
      <g
        transform="translate(12 12)"
        fill="none"
        stroke={tone}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={ICONS[icon] ?? ICONS.star} />
      </g>
    </svg>
  );
}
