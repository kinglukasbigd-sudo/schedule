import { m } from 'framer-motion';
import type { ReactNode } from 'react';
import type { SubjectColor } from '@/domain/types';
import { cx } from '@/lib/cx';
import { press } from '@/lib/motion';

interface ChipProps {
  selected?: boolean;
  onClick?: () => void;
  children: ReactNode;
  /** When set, the selected state uses the subject's pastel instead of the accent. */
  subject?: SubjectColor;
  className?: string;
  'data-testid'?: string;
  'data-subject-id'?: string;
}

/** 36px visible pill inside a 44px hit area. */
export function Chip({ selected, onClick, children, subject, className, ...rest }: ChipProps) {
  return (
    <m.button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      {...press}
      className={cx('group flex min-h-11 shrink-0 items-center', subject && `subject-${subject}`, className)}
      {...rest}
    >
      <span
        className={cx(
          'flex h-9 items-center gap-2 whitespace-nowrap rounded-full px-4 text-small font-medium transition-colors duration-fast',
          selected
            ? subject
              ? 'bg-subj-bg text-subj-fg'
              : 'bg-accent-soft text-accent'
            : 'bg-surface-2 text-ink-2 group-hover:bg-surface-3',
        )}
      >
        {subject && <span className={cx('h-2 w-2 rounded-full bg-subj-dot')} aria-hidden="true" />}
        {children}
      </span>
    </m.button>
  );
}
