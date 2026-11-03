import { useRef, type KeyboardEvent, type PointerEvent } from 'react';

import styles from './Admin.module.css';
import type { Limits } from './useColumnWidth';

const KEY_STEP = 16;

type Props = {
  label: string;
  width: number;
  limits: Limits;
  onChange: (width: number) => void;
};

/** Drag it, or focus it and use the arrow keys. It only shows where columns sit side by side. */
export function ColumnHandle({ label, width, limits, onChange }: Props) {
  const start = useRef<{ x: number; width: number } | null>(null);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    start.current = { x: event.clientX, width };
  };
  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (start.current) onChange(start.current.width + event.clientX - start.current.x);
  };
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowLeft') onChange(width - KEY_STEP);
    else if (event.key === 'ArrowRight') onChange(width + KEY_STEP);
    else if (event.key === 'Home') onChange(limits.min);
    else if (event.key === 'End') onChange(limits.max);
    else return;
    event.preventDefault();
  };

  return (
    <div
      className={styles.handle}
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={width}
      aria-valuemin={limits.min}
      aria-valuemax={limits.max}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={() => (start.current = null)}
      onPointerCancel={() => (start.current = null)}
      onKeyDown={handleKeyDown}
      onDoubleClick={() => onChange(limits.initial)}
    />
  );
}
