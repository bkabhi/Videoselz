import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.scss';

type Variant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  /** Renders a spinner over the label and blocks further clicks. */
  isLoading?: boolean;
  /** Square button for a lone icon. `aria-label` becomes required. */
  iconOnly?: boolean;
  children?: ReactNode;
}

export function Button({
  variant = 'secondary',
  isLoading = false,
  iconOnly = false,
  className,
  children,
  disabled,
  onClick,
  ...props
}: ButtonProps) {
  const classes = [
    styles.button,
    styles[variant],
    iconOnly ? styles.iconOnly : null,
    isLoading ? styles.loading : null,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={classes}
      // A loading button is functionally disabled, but marking it `disabled`
      // would drop it out of the tab order mid-interaction and move focus to
      // the body. `aria-disabled` keeps focus where the user put it.
      aria-disabled={isLoading || undefined}
      aria-busy={isLoading || undefined}
      disabled={disabled}
      {...props}
      // Spread first, then override: a caller's onClick must not reinstate
      // itself over the loading guard.
      onClick={isLoading ? undefined : onClick}
    >
      {children}
      {isLoading ? (
        <span className={styles.spinner}>
          <span className={styles.spinnerRing} />
        </span>
      ) : null}
    </button>
  );
}
