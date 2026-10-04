import { AnimatePresence, m } from 'framer-motion';
import { useEffect } from 'react';
import { useUI } from '@/state/ui';
import { spring } from '@/lib/motion';

const DURATION = 5000;

/** One toast at a time, above the tab bar, with an optional undo action. */
export function ToastHost() {
  const toast = useUI((s) => s.toast);
  const dismiss = useUI((s) => s.dismissToast);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => dismiss(toast.id), DURATION);
    return () => clearTimeout(timer);
  }, [toast, dismiss]);

  return (
    <div className="bottom-above-bar pointer-events-none fixed inset-x-0 z-toast flex justify-center px-4" aria-live="polite">
      <AnimatePresence>
        {toast && (
          <m.div
            key={toast.id}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={spring.snappy}
            className="pointer-events-auto flex min-h-12 w-full max-w-sm items-center gap-2 rounded-lg bg-ink pl-4 pr-1 text-small text-bg shadow-fab"
          >
            <span className="flex-1 py-3">{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                className="min-h-11 rounded-md px-3 font-semibold text-bg underline-offset-2 hover:underline"
                onClick={() => {
                  toast.action?.run();
                  dismiss(toast.id);
                }}
              >
                {toast.action.label}
              </button>
            )}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Visually hidden polite live region for status announcements. */
export function LiveRegion() {
  const message = useUI((s) => s.announcement);
  return (
    <div className="sr-only" aria-live="polite" aria-atomic="true">
      {message}
    </div>
  );
}
