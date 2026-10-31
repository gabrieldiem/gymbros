import type { ButtonHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router';

import styles from './Button.module.css';
import { cx } from './cx';

type Variant = 'primary' | 'ghost' | 'quiet';
type Common = { variant?: Variant; wide?: boolean };

function classes(variant: Variant, wide: boolean | undefined, extra?: string) {
  return cx(styles.button, styles[variant], wide && styles.wide, extra);
}

export function Button({
  variant = 'primary',
  wide,
  className,
  type = 'button',
  ...rest
}: Common & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={classes(variant, wide, className)} {...rest} />;
}

/** A router link styled as a button. */
export function ButtonLink({ variant = 'primary', wide, className, ...rest }: Common & LinkProps) {
  return <Link className={classes(variant, wide, className)} {...rest} />;
}
