import { useId, type InputHTMLAttributes } from 'react';

import styles from './TextField.module.css';

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string | undefined };

/** A labelled input with an optional hint linked through aria-describedby. */
export function TextField({ label, hint, ...input }: Props) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className={styles.input}
        aria-describedby={hint ? hintId : undefined}
        {...input}
      />
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
    </div>
  );
}
