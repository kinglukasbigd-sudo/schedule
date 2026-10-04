import { m } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { TABS, useUI, type Tab } from '@/state/ui';
import { cx } from '@/lib/cx';
import { spring } from '@/lib/motion';
import { tapFeedback } from '@/lib/haptics';
import { Icon, type IconName } from './Icon';

const ICONS: Record<Tab, IconName> = { today: 'today', week: 'week', tasks: 'tasks' };

export function TabBar() {
  const { t } = useTranslation();
  const tab = useUI((s) => s.tab);
  const setTab = useUI((s) => s.setTab);
  return (
    <nav
      aria-label={t('tabs.label')}
      className="h-bar fixed inset-x-0 bottom-0 z-bar border-t border-line bg-bar/80 backdrop-blur-bar"
    >
      <ul className="mx-auto flex h-14 max-w-content px-2">
        {TABS.map((name) => {
          const active = tab === name;
          return (
            <li key={name} className="flex-1">
              <button
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => {
                  if (!active) void tapFeedback();
                  setTab(name);
                  window.scrollTo({ top: 0 });
                }}
                className={cx(
                  'relative flex h-14 w-full flex-col items-center justify-center gap-1 text-caption font-medium transition-colors duration-fast',
                  active ? 'text-accent' : 'text-ink-3 hover:text-ink-2',
                )}
              >
                <m.span animate={{ scale: active ? 1 : 0.94 }} transition={spring.snappy}>
                  <Icon name={ICONS[name]} size={24} strokeWidth={active ? 2 : 1.75} />
                </m.span>
                {t(`tabs.${name}`)}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
