import type { LucideIcon } from 'lucide-react';
import { useLayoutEffect, useRef } from 'react';

import styles from './Segmented.module.css';

type Option<T extends string> = { value: T; label: string; icon?: LucideIcon };

type Props<T extends string> = {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Floats on a map: a dark glass track, and only the chosen option shows its name. */
  overlay?: boolean;
};

/** A plate track with a chalk thumb that slides to the selected option (docs/DESIGN.md). */
export function Segmented<T extends string>(props: Props<T>) {
  const { label, options, value, onChange, overlay = false } = props;
  const track = useRef<HTMLDivElement>(null);
  const labels = options.map((option) => option.label).join();

  useLayoutEffect(() => {
    const selected = track.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!track.current || !selected) return;
    track.current.style.setProperty('--thumb-x', `${selected.offsetLeft}px`);
    track.current.style.setProperty('--thumb-w', `${selected.offsetWidth}px`);
  }, [value, labels]);

  return (
    <div
      ref={track}
      className={overlay ? `${styles.seg} ${styles.overlay}` : styles.seg}
      role="group"
      aria-label={label}
    >
      <span className={styles.thumb} aria-hidden="true" />
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.icon && <option.icon size={16} aria-hidden="true" />}
          <span className={overlay && option.value !== value ? 'sr-only' : undefined}>
            {option.label}
          </span>
        </button>
      ))}
    </div>
  );
}
