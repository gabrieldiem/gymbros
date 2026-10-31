import type { CSSProperties } from 'react';

import type { CrewColor } from '../api/types';
import styles from './Avatar.module.css';

const COLOR_VARS: Record<CrewColor, string> = {
  volt: 'var(--crew-volt)',
  red: 'var(--crew-red)',
  cyan: 'var(--crew-cyan)',
  pink: 'var(--crew-pink)',
  violet: 'var(--crew-violet)',
};

type Props = { initials: string; color: CrewColor; size?: number };

/** Colored circle with initials. Decorative: the surrounding control carries the name. */
export function Avatar({ initials, color, size = 36 }: Props) {
  const style = { '--size': `${size}px`, '--color': COLOR_VARS[color] } as CSSProperties;
  return (
    <span className={styles.avatar} style={style} aria-hidden="true">
      {initials}
    </span>
  );
}
