import type { SVGProps } from 'react';

type Props = SVGProps<SVGSVGElement> & { size?: number };

/** "7d": the last week, as plainly as ∞ says all time. Sized and coloured like a lucide icon. */
export function SevenDaysIcon({ size = 24, ...props }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...props}>
      <text
        x="12"
        y="12.5"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="var(--display)"
        fontSize="19"
        fontWeight="800"
      >
        7d
      </text>
    </svg>
  );
}
