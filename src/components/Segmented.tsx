import { m } from 'framer-motion';
import { useId, useRef, type KeyboardEvent } from 'react';
import { cx } from '@/lib/cx';
import { spring } from '@/lib/motion';

interface SegmentedProps<T extends string> {
  value: T;
  options: { value: T; label: string; ariaLabel?: string }[];
  onChange: (value: T) => void;
  label: string;
  className?: string;
}

/** Radio group with a sliding thumb. Arrow keys move the selection. */
export function Segmented<T extends string>({ value, options, onChange, label, className }: SegmentedProps<T>) {
  const id = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent, index: number) => {
    const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (index + delta + options.length) % options.length;
    const opt = options[next];
    if (opt) onChange(opt.value);
    refs.current[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className={cx('flex rounded-md bg-surface-2 p-1', className)}>
      {options.map((opt, i) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={opt.ariaLabel}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => onKey(e, i)}
            className={cx(
              'relative flex min-h-9 flex-1 items-center justify-center rounded-sm px-2 text-small font-medium transition-colors duration-fast',
              active ? 'text-ink' : 'text-ink-2 hover:text-ink',
            )}
          >
            {active && (
              <m.span
                layoutId={`seg-${id}`}
                transition={spring.snappy}
                className="absolute inset-0 rounded-sm bg-surface shadow-thumb"
                aria-hidden="true"
              />
            )}
            <span className="relative truncate">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
