import { addDays, addWeeks, startOfISOWeek } from 'date-fns';
import { AnimatePresence, m } from 'framer-motion';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, IconButton } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useSubjects, useTasks, useTimetable } from '@/db/hooks';
import { isValidBell, lessonAt, toDateKey } from '@/domain/schedule';
import { isOpen } from '@/domain/tasks';
import type { Task, Weekday } from '@/domain/types';
import { abbreviate } from '@/lib/text';
import { cx } from '@/lib/cx';
import { useFormat } from '@/lib/format';
import { spring } from '@/lib/motion';
import { useNow } from '@/lib/useNow';
import { useUI } from '@/state/ui';

const COLS: Record<number, string> = {
  1: 'grid-cols-week-1',
  2: 'grid-cols-week-2',
  3: 'grid-cols-week-3',
  4: 'grid-cols-week-4',
  5: 'grid-cols-week-5',
  6: 'grid-cols-week-6',
  7: 'grid-cols-week-7',
};

export function WeekScreen() {
  const { t } = useTranslation();
  const f = useFormat();
  const now = useNow();
  const tt = useTimetable();
  const { byId } = useSubjects();
  const { tasks } = useTasks();
  const openSheet = useUI((s) => s.openSheet);
  const push = useUI((s) => s.push);
  const [offset, setOffset] = useState(0);
  const [direction, setDirection] = useState(0);

  const weekStart = useMemo(() => addWeeks(startOfISOWeek(now), offset), [now, offset]);
  const days = tt?.days.length ? tt.days : ([1, 2, 3, 4, 5] as Weekday[]);
  const dates = days.map((d) => addDays(weekStart, d - 1));
  const todayKey = toDateKey(now);

  // Open tasks indexed by date + subject for the dots in each cell.
  const dueIndex = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      if (!isOpen(task) || !task.subjectId) continue;
      const key = `${task.due}|${task.subjectId}`;
      map.set(key, [...(map.get(key) ?? []), task]);
    }
    return map;
  }, [tasks]);

  const go = (delta: number) => {
    setDirection(delta);
    setOffset((o) => (delta === 0 ? 0 : o + delta));
  };

  const first = dates[0] ?? weekStart;
  const last = dates[dates.length - 1] ?? weekStart;
  const range = `${f.dayMonth(first)} – ${f.dayMonth(last)}`;

  return (
    <>
      <ScreenHeader
        eyebrow={offset === 0 ? t('week.thisWeek') : range}
        title={t('week.title')}
        actions={
          <IconButton icon="settings" label={t('settings.title')} onClick={() => push({ name: 'settings' })} />
        }
      />
      {!tt ? (
        tt === null && (
          <section aria-labelledby="week-no-timetable" className="rounded-lg bg-surface shadow-card">
            <EmptyState
              icon="grid"
              heading={{ level: 'h2', id: 'week-no-timetable' }}
              title={t('today.noTimetable')}
              body={t('today.noTimetableBody')}
              action={
                <Button variant="secondary" icon="plus" onClick={() => push({ name: 'setup' })}>
                  {t('today.addTimetable')}
                </Button>
              }
            />
          </section>
        )
      ) : (
        <>
          <div className="mb-4 flex items-center gap-1">
            <IconButton icon="chevronLeft" label={t('week.previous')} onClick={() => go(-1)} className="-ml-2" />
            <p className="tabular flex-1 text-center text-small font-medium text-ink-2" aria-live="polite">
              {range}
            </p>
            {offset !== 0 && (
              <Button variant="ghost" onClick={() => go(0)} className="text-accent">
                {t('week.today')}
              </Button>
            )}
            <IconButton icon="chevronRight" label={t('week.next')} onClick={() => go(1)} className="-mr-2" />
          </div>

          <AnimatePresence mode="popLayout" initial={false} custom={direction}>
            <m.div
              key={offset}
              custom={direction}
              initial={{ opacity: 0, x: direction * 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -24 }}
              transition={spring.gentle}
              role="grid"
              aria-label={t('week.gridLabel', { range })}
              aria-rowcount={tt.bells.length + 1}
              className={cx('grid gap-1', COLS[days.length])}
              data-testid="week-grid"
            >
              <div role="row" className="contents">
                <span role="columnheader" aria-label={t('week.period')} />
                {dates.map((d) => {
                  const isToday = toDateKey(d) === todayKey;
                  return (
                    <span
                      key={toDateKey(d)}
                      role="columnheader"
                      aria-current={isToday ? 'date' : undefined}
                      className="flex flex-col items-center pb-1"
                    >
                      <span className={cx('text-caption font-semibold uppercase', isToday ? 'text-accent' : 'text-ink-3')}>
                        {f.weekdayShort(d)}
                      </span>
                      <span
                        className={cx(
                          'tabular mt-1 flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-small font-semibold',
                          isToday ? 'bg-accent text-accent-fg' : 'text-ink',
                        )}
                      >
                        {f.monthDay(d)}
                      </span>
                    </span>
                  );
                })}
              </div>

              {tt.bells.map((bell, period) => (
                <div role="row" className="contents" key={period}>
                  <span role="rowheader" className="flex flex-col items-end justify-center pr-1 text-right">
                    <span className="text-small font-semibold text-ink-2">{period + 1}</span>
                    {isValidBell(bell) && <span className="tabular text-caption text-ink-3">{bell.start}</span>}
                  </span>
                  {dates.map((date, col) => {
                    const day = days[col] as Weekday;
                    const lesson = lessonAt(tt, day, period);
                    const subject = lesson ? byId.get(lesson.subjectId) : undefined;
                    const key = toDateKey(date);
                    if (!lesson || !subject) {
                      return <span role="gridcell" key={key} className="min-h-14 rounded-md" aria-label={t('week.free')} />;
                    }
                    const due = dueIndex.get(`${key}|${subject.id}`) ?? [];
                    const start = isValidBell(bell) ? new Date(`${key}T${bell.start}`) : null;
                    const end = isValidBell(bell) ? new Date(`${key}T${bell.end}`) : null;
                    const current = !!start && !!end && start <= now && now < end;
                    const cellLabel = [
                      subject.name,
                      f.weekday(date),
                      isValidBell(bell) ? `${bell.start}–${bell.end}` : '',
                      lesson.room ? t('lesson.room', { room: lesson.room }) : '',
                      due.length ? t('week.dueCount', { count: due.length }) : '',
                    ]
                      .filter(Boolean)
                      .join(', ');
                    return (
                      <span role="gridcell" key={key} className="flex">
                        <m.button
                          type="button"
                          whileTap={{ scale: 0.96 }}
                          transition={spring.snappy}
                          onClick={() => openSheet({ type: 'lesson', date: key, day, period })}
                          aria-label={cellLabel}
                          className={cx(
                            `subject-${subject.color}`,
                            'relative flex min-h-14 w-full flex-col items-start overflow-hidden rounded-md bg-subj-bg p-2 text-left text-subj-fg',
                            current && 'ring-2 ring-accent ring-offset-2 ring-offset-bg',
                          )}
                        >
                          <span className="w-full truncate text-caption font-semibold sm:hidden">{abbreviate(subject.name)}</span>
                          <span className="hidden w-full hyphens-auto break-words text-small font-semibold leading-5 sm:line-clamp-2">{subject.name}</span>
                          {lesson.room && <span className="w-full truncate text-caption opacity-80">{lesson.room}</span>}
                          {due.length > 0 && (
                            <span className="mt-auto flex gap-1 pt-1" aria-hidden="true">
                              {due.slice(0, 3).map((task) => (
                                <span
                                  key={task.id}
                                  className={cx(
                                    'h-2 w-2',
                                    task.kind === 'test' ? 'rounded-xs bg-subj-fg' : 'rounded-full border border-subj-fg',
                                  )}
                                />
                              ))}
                            </span>
                          )}
                        </m.button>
                      </span>
                    );
                  })}
                </div>
              ))}
            </m.div>
          </AnimatePresence>
        </>
      )}
    </>
  );
}
