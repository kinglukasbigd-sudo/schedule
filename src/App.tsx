import { AnimatePresence, LazyMotion, MotionConfig } from 'framer-motion';
import { useEffect } from 'react';
import { Fab } from '@/components/Fab';
import { ScreenFrame } from '@/components/ScreenFrame';
import { TabBar } from '@/components/TabBar';
import { LiveRegion, ToastHost } from '@/components/Toast';
import { SetupFlow } from '@/features/onboarding/SetupFlow';
import { SettingsScreen } from '@/features/settings/SettingsScreen';
import { TimetableScreen } from '@/features/settings/TimetableScreen';
import { SheetHost } from '@/features/sheets/SheetHost';
import { TasksScreen } from '@/features/tasks/TasksScreen';
import { TodayScreen } from '@/features/today/TodayScreen';
import { WeekScreen } from '@/features/week/WeekScreen';
import { setLanguage } from '@/i18n';
import { cx } from '@/lib/cx';
import { fade, spring } from '@/lib/motion';
import { useApplyAppearance } from '@/lib/useTheme';
import { useSettings } from '@/state/settings';
import { bindHistory, useUI, type Tab } from '@/state/ui';

const loadMotionFeatures = () => import('@/lib/motionFeatures').then((mod) => mod.default);

const SCREENS: Record<Tab, () => React.JSX.Element> = {
  today: TodayScreen,
  week: WeekScreen,
  tasks: TasksScreen,
};

export function App() {
  const settings = useSettings((s) => s.settings);
  const hydrated = useSettings((s) => s.hydrated);
  const tab = useUI((s) => s.tab);
  const screens = useUI((s) => s.screens);
  const openSheet = useUI((s) => s.openSheet);
  const back = useUI((s) => s.back);
  const setTab = useUI((s) => s.setTab);

  useApplyAppearance(settings);
  useEffect(() => {
    void setLanguage(settings.language);
  }, [settings.language]);
  useEffect(() => bindHistory(), []);

  if (!hydrated) return null;

  const top = screens[screens.length - 1];
  const Screen = SCREENS[tab];
  // Grids get room to breathe on wide screens; reading screens keep a comfortable measure.
  const wide = (!top && tab === 'week') || top?.name === 'timetable';

  let content: React.ReactNode;
  if (!settings.onboarded) {
    content = <SetupFlow firstRun onDone={() => setTab('today')} />;
  } else if (top?.name === 'setup') {
    content = <SetupFlow firstRun={false} onDone={back} onCancel={back} />;
  } else {
    content = (
      <>
        <main className={cx('pb-screen mx-auto px-4', wide ? 'max-w-wide' : 'max-w-content')}>
          <AnimatePresence mode="wait" initial={false}>
            <ScreenFrame
              key={top ? top.name : tab}
              initial={top ? { opacity: 0, x: 24 } : { opacity: 0 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={top ? spring.gentle : fade}
            >
              {top?.name === 'settings' ? <SettingsScreen /> : top?.name === 'timetable' ? <TimetableScreen /> : <Screen />}
            </ScreenFrame>
          </AnimatePresence>
        </main>
        <AnimatePresence>{!top && <Fab key="fab" onClick={() => openSheet({ type: 'task' })} />}</AnimatePresence>
        <TabBar />
      </>
    );
  }

  return (
    <LazyMotion features={loadMotionFeatures} strict>
      <MotionConfig reducedMotion="user">
        <div id="app" className="min-h-screen bg-bg text-ink">
          {content}
        </div>
        <SheetHost />
        <ToastHost />
        <LiveRegion />
      </MotionConfig>
    </LazyMotion>
  );
}
