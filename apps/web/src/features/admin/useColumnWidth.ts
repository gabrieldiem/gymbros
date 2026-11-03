import { useCallback, useState } from 'react';

export type Limits = { name: string; initial: number; min: number; max: number };

const clamp = (value: number, { min, max }: Limits) => Math.min(max, Math.max(min, value));

function stored({ name, initial, ...rest }: Limits): number {
  const saved = Number(localStorage.getItem(name));
  return saved ? clamp(saved, { name, initial, ...rest }) : initial;
}

/** A column's width, remembered on this device. */
export function useColumnWidth(limits: Limits) {
  const [width, setWidth] = useState(() => stored(limits));
  const change = useCallback(
    (next: number) => {
      const value = clamp(next, limits);
      setWidth(value);
      localStorage.setItem(limits.name, String(value));
    },
    [limits],
  );
  return [width, change] as const;
}
