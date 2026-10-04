import { m } from 'framer-motion';
import type { TaskKind } from '@/domain/types';
import { cx } from '@/lib/cx';

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  kind?: TaskKind;
}

/** Circle for homework and assignments, rounded square for tests. 44px target. */
export function Checkbox({ checked, onChange, label, kind = 'homework' }: CheckboxProps) {
  const shape = kind === 'test' ? 'rounded-sm' : 'rounded-full';
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className="group -m-2 flex h-11 w-11 shrink-0 items-center justify-center"
    >
      <m.span
        animate={{ scale: checked ? [1, 0.82, 1] : 1 }}
        transition={{ duration: 0.24, ease: 'easeOut' }}
        className={cx(
          'flex h-6 w-6 items-center justify-center border-2 transition-colors duration-fast',
          shape,
          checked ? 'border-accent bg-accent text-accent-fg' : 'border-line-strong group-hover:border-ink-2',
        )}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <m.path
            d="M20 6 9 17l-5-5"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={false}
            animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
            transition={{ duration: 0.18 }}
          />
        </svg>
      </m.span>
    </button>
  );
}
