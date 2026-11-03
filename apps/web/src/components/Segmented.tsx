import type { LucideIcon } from 'lucide-react';
import { useLayoutEffect, useRef } from 'react';

import styles from './Segmented.module.css';

type Option<T extends string> = { value: T; label: string; icon?: LucideIcon };

type Props<T extends string> = {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
};

/** A plate track with a chalk thumb that slides to the selected option (docs/DESIGN.md). */
export function Segmented<T extends string>({ label, options, value, onChange }: Props<T>) {
  const track = useRef<HTMLDivElement>(null);
  const labels = options.map((option) => option.label).join();

  useLayoutEffect(() => {
    const selected = track.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!track.current || !selected) return;
    track.current.style.setProperty('--thumb-x', `${selected.offsetLeft}px`);
    track.current.style.setProperty('--thumb-w', `${selected.offsetWidth}px`);
  }, [value, labels]);

  return (
    <div ref={track} className={styles.seg} role="group" aria-label={label}>
      <span className={styles.thumb} aria-hidden="true" />
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.icon && <option.icon size={16} aria-hidden="true" />}
          {option.label}
        </button>
      ))}
    </div>
  );
}
