/** Stroke icons from the prototype (24×24, currentColor). Decorative: always aria-hidden. */
const PATHS = {
  climb: 'M4 21c5 0 2-6 8-6s3-6 8-6 M18 9V3l3 1.5L18 6',
  crew: 'M16 5.2a3 3 0 0 1 0 5.6 M18 14.5c1.9.8 3 2.8 3 5.5 M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6',
  plus: 'M12 5v14 M5 12h14',
  flag: 'M5 21V4 M5 4h12l-2.5 4 2.5 4H5',
  bars: 'M5 20v-8 M12 20V5 M19 20v-5',
} as const;

export type IconName = keyof typeof PATHS;

type IconProps = { name: IconName; size?: number; strokeWidth?: number };

export function Icon({ name, size = 24, strokeWidth = 2 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {name === 'crew' && <circle cx="9" cy="8" r="3.2" />}
      <path d={PATHS[name]} />
    </svg>
  );
}
