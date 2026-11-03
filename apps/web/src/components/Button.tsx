import type { LucideIcon } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router';

import styles from './Button.module.css';
import { cx } from './cx';

type Variant = 'primary' | 'ghost' | 'quiet';
type Common = {
  variant?: Variant;
  wide?: boolean;
  /** Drawn before the label. Decorative: the label says what it does. */
  icon?: LucideIcon;
};

function classes(variant: Variant, wide: boolean | undefined, extra?: string) {
  return cx(styles.button, styles[variant], wide && styles.wide, extra);
}

export function Button({
  variant = 'primary',
  wide,
  className,
  type = 'button',
  icon: IconShape,
  children,
  ...rest
}: Common & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={classes(variant, wide, className)} {...rest}>
      {IconShape && <IconShape size={18} aria-hidden="true" />}
      {children}
    </button>
  );
}

/** A router link styled as a button. */
export function ButtonLink({
  variant = 'primary',
  wide,
  className,
  icon: IconShape,
  children,
  ...rest
}: Common & LinkProps) {
  return (
    <Link className={classes(variant, wide, className)} {...rest}>
      {IconShape && <IconShape size={18} aria-hidden="true" />}
      {children}
    </Link>
  );
}
