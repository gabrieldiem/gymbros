import type { CrewColor } from '../api/types';

/** The crew palette (docs/DESIGN.md). A member can also pick any color, kept as #rrggbb. */
const PALETTE: Record<string, string> = {
  volt: '#FFE600',
  red: '#FF3B1F',
  cyan: '#00D1FF',
  pink: '#FF4FD8',
  violet: '#B48CFF',
};

/** The color as #rrggbb, for SVG and anything else that can't read a CSS variable. */
export const memberColorHex = (color: CrewColor): string => PALETTE[color] ?? color;

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  );
}

/** Dark or light text, whichever reads better on this color. */
export const inkOn = (color: CrewColor): string =>
  luminance(memberColorHex(color)) > 0.18 ? '#0D0D0D' : '#F2F2EE';
