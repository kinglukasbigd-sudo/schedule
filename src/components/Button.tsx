import { m, type HTMLMotionProps } from 'framer-motion';
import { forwardRef } from 'react';
import { press } from '@/lib/motion';
import { cx } from '@/lib/cx';
import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg font-semibold',
  secondary: 'bg-surface-2 text-ink font-medium hover:bg-surface-3',
  ghost: 'bg-transparent text-ink-2 font-medium hover:bg-surface-2',
  danger: 'bg-transparent text-danger font-medium hover:bg-danger-soft',
};

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: Variant;
  size?: 'md' | 'lg';
  icon?: IconName;
  block?: boolean;
  children?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, block, className, children, type = 'button', disabled, ...rest },
  ref,
) {
  return (
    <m.button
      ref={ref}
      type={type}
      disabled={disabled}
      {...(disabled ? {} : press)}
      className={cx(
        'inline-flex select-none items-center justify-center gap-2 rounded-md px-4 text-body transition-colors duration-fast',
        size === 'lg' ? 'min-h-12' : 'min-h-11',
        block && 'w-full',
        VARIANTS[variant],
        disabled && 'opacity-40',
        className,
      )}
      {...rest}
    >
      {icon && <Icon name={icon} size={20} />}
      {children}
    </m.button>
  );
});

interface IconButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  icon: IconName;
  label: string;
  tone?: 'default' | 'accent';
}

/** 44×44 hit target around a 24px icon. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, tone = 'default', className, type = 'button', ...rest },
  ref,
) {
  return (
    <m.button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      {...press}
      className={cx(
        'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors duration-fast hover:bg-surface-2',
        tone === 'accent' ? 'text-accent' : 'text-ink-2',
        className,
      )}
      {...rest}
    >
      <Icon name={icon} />
    </m.button>
  );
});
