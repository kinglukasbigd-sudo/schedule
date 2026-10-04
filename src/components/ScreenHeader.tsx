import { AnimatePresence, m } from 'framer-motion';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { fade } from '@/lib/motion';
import { cx } from '@/lib/cx';

interface ScreenHeaderProps {
  title: string;
  eyebrow?: ReactNode;
  /** Right-aligned actions (icon buttons). */
  actions?: ReactNode;
  /** Left-aligned leading control, e.g. a back button. */
  leading?: ReactNode;
}

/**
 * Large title that hands over to a compact, blurred bar once it scrolls away —
 * the screen always says where you are without spending space on it.
 */
export function ScreenHeader({ title, eyebrow, actions, leading }: ScreenHeaderProps) {
  const sentinel = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => setCompact(!entry?.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      <div className="pt-safe sticky top-0 z-bar -mx-4">
        <div
          className={cx(
            'flex h-14 items-center gap-1 px-2 transition-colors duration-fast',
            compact ? 'border-b border-line bg-bar/80 backdrop-blur-bar' : 'border-b border-transparent',
          )}
        >
          <div className="flex min-w-11 items-center">{leading}</div>
          <div className="min-w-0 flex-1 text-center">
            <AnimatePresence>
              {compact && (
                <m.span
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={fade}
                  className="block truncate text-body font-semibold"
                  aria-hidden="true"
                >
                  {title}
                </m.span>
              )}
            </AnimatePresence>
          </div>
          <div className="flex min-w-11 items-center justify-end">{actions}</div>
        </div>
      </div>
      <header className="pb-4">
        {eyebrow && <p className="text-caption font-semibold uppercase tracking-wide text-ink-3">{eyebrow}</p>}
        <h1 className="text-large font-semibold text-ink">{title}</h1>
        <div ref={sentinel} aria-hidden="true" />
      </header>
    </>
  );
}

/** Section label used across screens. */
export function SectionLabel({ children, tone = 'muted', id }: { children: ReactNode; tone?: 'muted' | 'danger'; id?: string }) {
  return (
    <h2
      id={id}
      className={cx(
        'mb-2 text-caption font-semibold uppercase tracking-wide',
        tone === 'danger' ? 'text-danger' : 'text-ink-3',
      )}
    >
      {children}
    </h2>
  );
}
