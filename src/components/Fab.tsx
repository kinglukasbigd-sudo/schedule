import { m } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { spring } from '@/lib/motion';
import { tapFeedback } from '@/lib/haptics';
import { useUI } from '@/state/ui';
import { Icon } from './Icon';

/** The screen's primary action: add something. */
export function Fab({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  // Make room for the toast instead of hiding behind it.
  const lifted = useUI((s) => s.toast != null);
  return (
    <div className="bottom-above-bar pointer-events-none fixed inset-x-0 z-fab">
      <div className="mx-auto flex max-w-content justify-end px-4">
        <m.button
          type="button"
          aria-label={t('fab.add')}
          title={t('fab.add')}
          data-testid="fab"
          onClick={() => {
            void tapFeedback('medium');
            onClick();
          }}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1, y: lifted ? -64 : 0 }}
          exit={{ scale: 0.6, opacity: 0 }}
          whileTap={{ scale: 0.92 }}
          transition={spring.snappy}
          className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-fg shadow-fab"
        >
          <Icon name="plus" size={28} strokeWidth={2.25} />
        </m.button>
      </div>
    </div>
  );
}
