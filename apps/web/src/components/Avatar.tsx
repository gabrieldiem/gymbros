import type { CSSProperties } from 'react';

import type { CrewColor } from '../api/types';
import styles from './Avatar.module.css';
import { inkOn, memberColorHex } from './memberColor';

type Props = {
  initials: string;
  color: CrewColor;
  /** An uploaded picture, which takes the place of the characters. */
  image?: string | null | undefined;
  size?: number;
};

/** A member's picture, or a colored circle with their characters. Decorative: the surrounding
 * control carries the name. */
export function Avatar({ initials, color, image, size = 36 }: Props) {
  const style = {
    '--size': `${size}px`,
    '--color': memberColorHex(color),
    '--ink': inkOn(color),
  } as CSSProperties;
  return (
    <span className={styles.avatar} style={style} aria-hidden="true">
      {image ? <img src={image} alt="" loading="lazy" draggable={false} /> : initials}
    </span>
  );
}
