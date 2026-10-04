import { AnimatePresence, m } from 'framer-motion';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconButton } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { ScreenHeader, SectionLabel } from '@/components/ScreenHeader';
import { useSubjects, useTasks, useTimetable } from '@/db/hooks';
import { groupOpenTasks, recentlyDone } from '@/domain/tasks';
import { cx } from '@/lib/cx';
import { spring } from '@/lib/motion';
import { useNow } from '@/lib/useNow';
import { useUI } from '@/state/ui';
import { TaskRow } from './TaskRow';

export function TasksScreen() {
  const { t } = useTranslation();
  const now = useNow();
  const tt = useTimetable();
  const { tasks, ready } = useTasks();
  const { byId } = useSubjects();
  const push = useUI((s) => s.push);
  const [showDone, setShowDone] = useState(false);

  const groups = useMemo(() => groupOpenTasks(tasks, tt ?? undefined, now), [tasks, tt, now]);
  const done = useMemo(() => recentlyDone(tasks), [tasks]);
  const openCount = groups.reduce((n, g) => n + g.tasks.length, 0);

  return (
    <>
      <ScreenHeader
        eyebrow={openCount > 0 ? t('tasks.openCount', { count: openCount }) : undefined}
        title={t('tasks.title')}
        actions={<IconButton icon="settings" label={t('settings.title')} onClick={() => push({ name: 'settings' })} />}
      />

      {ready && openCount === 0 && (
        <div className="mb-8 rounded-lg bg-surface shadow-card">
          <EmptyState icon="check" title={t('tasks.emptyTitle')} body={t('tasks.emptyBody')} />
        </div>
      )}

      <div className="flex flex-col gap-8">
        <AnimatePresence initial={false}>
          {groups.map((group) => (
            <m.section
              key={group.bucket}
              layout="position"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={spring.gentle}
              aria-labelledby={`bucket-${group.bucket}`}
            >
              <SectionLabel id={`bucket-${group.bucket}`} tone={group.bucket === 'overdue' ? 'danger' : 'muted'}>
                {t(`tasks.bucket.${group.bucket}`)}
              </SectionLabel>
              <ul className="overflow-hidden rounded-lg bg-surface shadow-card">
                <AnimatePresence initial={false}>
                  {group.tasks.map((task, i) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      subject={task.subjectId ? byId.get(task.subjectId) : undefined}
                      tt={tt}
                      now={now}
                      dueStyle={group.bucket === 'today' || group.bucket === 'tomorrow' ? 'time' : 'full'}
                      last={i === group.tasks.length - 1}
                    />
                  ))}
                </AnimatePresence>
              </ul>
            </m.section>
          ))}
        </AnimatePresence>

        {done.length > 0 && (
          <section aria-labelledby="bucket-done">
            <h2 id="bucket-done">
              <button
                type="button"
                aria-expanded={showDone}
                onClick={() => setShowDone((v) => !v)}
                className="-ml-2 flex min-h-11 items-center gap-1 rounded-md px-2 text-caption font-semibold uppercase tracking-wide text-ink-3 hover:text-ink-2"
              >
                {t('tasks.done', { count: done.length })}
                <Icon
                  name="chevronDown"
                  size={16}
                  className={cx('transition-transform duration-fast', showDone && 'rotate-180')}
                />
              </button>
            </h2>
            <AnimatePresence initial={false}>
              {showDone && (
                <m.ul
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={spring.gentle}
                  className="overflow-hidden rounded-lg bg-surface shadow-card"
                >
                  <AnimatePresence initial={false}>
                    {done.map((task, i) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        subject={task.subjectId ? byId.get(task.subjectId) : undefined}
                        tt={tt}
                        now={now}
                        last={i === done.length - 1}
                      />
                    ))}
                  </AnimatePresence>
                </m.ul>
              )}
            </AnimatePresence>
          </section>
        )}
      </div>
    </>
  );
}
