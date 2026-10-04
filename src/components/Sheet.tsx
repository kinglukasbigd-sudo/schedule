import { AnimatePresence, m, useDragControls, type PanInfo } from 'framer-motion';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { cx } from '@/lib/cx';
import { fade, spring } from '@/lib/motion';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { IconButton } from './Button';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Small line above the title. */
  eyebrow?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Extra class on the title row, e.g. a subject colour scope. */
  headerClassName?: string;
  testId?: string;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Height of the on-screen keyboard where the browser overlays it (iOS Safari / PWA). */
function useKeyboardInset(active: boolean): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!active || !vv) return;
    const update = () => setInset(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)));
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [active]);
  return active ? inset : 0;
}

/**
 * Bottom sheet on phones, centred dialog on wider screens. Swipe down on the handle,
 * tap the backdrop or press Escape to close. Focus is trapped and restored.
 */
export function Sheet({ open, onClose, title, eyebrow, children, footer, headerClassName, testId }: SheetProps) {
  const { t } = useTranslation();
  const wide = useMediaQuery('(min-width: 640px)');
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const controls = useDragControls();
  const keyboard = useKeyboardInset(open && !wide);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const app = document.getElementById('app');
    app?.setAttribute('inert', '');
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    const raf = requestAnimationFrame(() => {
      const root = panel.current;
      const target = root?.querySelector<HTMLElement>('[data-autofocus]') ?? root;
      target?.focus({ preventScroll: true });
    });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey);
      app?.removeAttribute('inert');
      document.body.style.overflow = overflow;
      previous?.focus?.({ preventScroll: true });
    };
  }, [open]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 600) onClose();
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-sheet flex items-end justify-center sm:items-center sm:p-6">
          <m.div
            className="absolute inset-0 bg-scrim/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={fade}
            onClick={onClose}
            aria-hidden="true"
          />
          <m.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            data-testid={testId}
            className={cx(
              'relative flex max-h-sheet w-full max-w-content flex-col bg-surface shadow-sheet outline-none',
              wide ? 'rounded-3xl' : 'rounded-t-3xl',
            )}
            style={{ marginBottom: keyboard }}
            initial={wide ? { opacity: 0, scale: 0.96 } : { y: '100%' }}
            animate={wide ? { opacity: 1, scale: 1 } : { y: 0 }}
            exit={wide ? { opacity: 0, scale: 0.96 } : { y: '100%' }}
            transition={spring.sheet}
            drag={wide ? false : 'y'}
            dragControls={controls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.7 }}
            onDragEnd={onDragEnd}
          >
            <div
              className={cx('shrink-0 touch-none px-4 pt-2', headerClassName)}
              onPointerDown={(e) => !wide && controls.start(e)}
            >
              {!wide && <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-line" aria-hidden="true" />}
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1 pt-2">
                  {eyebrow && <div className="text-caption font-semibold uppercase tracking-wide text-ink-3">{eyebrow}</div>}
                  <h2 id={titleId} className="text-title font-semibold text-ink">
                    {title}
                  </h2>
                </div>
                <IconButton icon="x" label={t('common.close')} onClick={onClose} className="-mr-2" />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-4 pb-4 pt-2">{children}</div>
            {footer && <div className="pb-safe shrink-0 border-t border-line px-4 pt-3">{footer}</div>}
          </m.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
