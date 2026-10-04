import { AnimatePresence, m } from 'framer-motion';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, IconButton } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { ScreenHeader, SectionLabel } from '@/components/ScreenHeader';
import { KindBadge, SubjectTag } from '@/components/SubjectBadge';
import { useSubjects, useTasks, useTimetable } from '@/db/hooks';
import { fromDateKey, lessonsOnDate, nextSchoolDay, toDateKey, type LessonInstance } from '@/domain/schedule';
import { comingUp, rankNextUp, tasksForLesson } from '@/domain/tasks';
import type { Subject, Task, Timetable } from '@/domain/types';
import { useDueText } from '@/features/tasks/dueText';
import { useTaskActions } from '@/features/tasks/useTaskActions';
import { cx } from '@/lib/cx';
import { useFormat } from '@/lib/format';
import { spring } from '@/lib/motion';
import { useNow } from '@/lib/useNow';
import { useUI } from '@/state/ui';

export function TodayScreen() {
  const { t } = useTranslation();
  const f = useFormat();
  const now = useNow();
  const tt = useTimetable();
  const { tasks } = useTasks();
  const { byId } = useSubjects();
  const push = useUI((s) => s.push);

  const ranked = useMemo(() => rankNextUp(tasks, tt ?? undefined, now), [tasks, tt, now]);
  const upcoming = useMemo(() => comingUp(tasks, now), [tasks, now]);
  const [first, ...rest] = ranked;

  return (
    <>
      <ScreenHeader
        eyebrow={f.fullDate(now)}
        title={t('today.title')}
        actions={<IconButton icon="settings" label={t('settings.title')} onClick={() => push({ name: 'settings' })} />}
      />
      <div className="flex flex-col gap-8">
        <section aria-labelledby="next-up">
          <SectionLabel id="next-up">{t('today.nextUp')}</SectionLabel>
          <AnimatePresence mode="popLayout" initial={false}>
            <m.div
              key={first?.id ?? 'clear'}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={spring.gentle}
            >
              {first ? (
                <NextUpCard task={first} then={rest.slice(0, 2)} tt={tt} now={now} subjects={byId} />
              ) : (
                <div className="rounded-lg bg-surface shadow-card">
                  <EmptyState icon="sparkle" title={t('today.allClear')} body={t('today.allClearBody')} />
                </div>
              )}
            </m.div>
          </AnimatePresence>
        </section>

        {tt === null ? (
          <NoTimetable onAdd={() => push({ name: 'setup' })} />
        ) : tt ? (
          <Lessons tt={tt} now={now} tasks={tasks} subjects={byId} />
        ) : null}

        {upcoming.length > 0 && (
          <section aria-labelledby="coming-up">
            <SectionLabel id="coming-up">{t('today.comingUp')}</SectionLabel>
            <ComingUp tasks={upcoming} subjects={byId} now={now} />
          </section>
        )}
      </div>
    </>
  );
}

interface NextUpProps {
  task: Task;
  then: Task[];
  tt: Timetable | null | undefined;
  now: Date;
  subjects: Map<string, Subject>;
}

function NextUpCard({ task, then, tt, now, subjects }: NextUpProps) {
  const { t } = useTranslation();
  const openSheet = useUI((s) => s.openSheet);
  const { complete, label } = useTaskActions();
  const dueText = useDueText();
  const subject = task.subjectId ? subjects.get(task.subjectId) : undefined;
  const due = dueText(task, tt, now, 'long');

  return (
    <article className="overflow-hidden rounded-lg bg-surface shadow-card" data-testid="next-up">
      <button
        type="button"
        onClick={() => openSheet({ type: 'task', taskId: task.id })}
        className="block w-full px-4 pt-4 text-left"
      >
        <span className="flex min-h-6 items-center gap-2 text-small text-ink-2">
          <SubjectTag subject={subject} />
          {task.title && <KindBadge kind={task.kind} />}
        </span>
        <span className="mt-1 block text-title font-semibold text-ink">{label(task)}</span>
        <span className={cx('mt-1 block text-small', due.overdue ? 'font-medium text-danger' : 'text-ink-2')}>{due.text}</span>
      </button>
      <div className="px-4 pb-4 pt-4">
        <Button variant="secondary" icon="check" onClick={() => void complete(task)} data-testid="next-up-done">
          {t('today.markDone')}
        </Button>
      </div>
      {then.length > 0 && (
        <div className="border-t border-line px-4 py-2">
          <p className="pt-2 text-caption font-semibold uppercase tracking-wide text-ink-3">{t('today.then')}</p>
          <ul>
            {then.map((task) => {
              const s = task.subjectId ? subjects.get(task.subjectId) : undefined;
              const d = dueText(task, tt, now);
              return (
                <li key={task.id}>
                  <button
                    type="button"
                    onClick={() => openSheet({ type: 'task', taskId: task.id })}
                    className={cx('flex min-h-11 w-full items-center gap-2 text-left text-small', s && `subject-${s.color}`)}
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full bg-subj-dot" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-ink">{label(task)}</span>
                    <span className={cx('shrink-0 tabular', d.overdue ? 'text-danger' : 'text-ink-3')}>{d.text}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </article>
  );
}

function NoTimetable({ onAdd }: { onAdd: () => void }) {
  const { t } = useTranslation();
  return (
    <section className="rounded-lg bg-surface shadow-card">
      <EmptyState
        icon="grid"
        title={t('today.noTimetable')}
        body={t('today.noTimetableBody')}
        action={
          <Button variant="secondary" icon="plus" onClick={onAdd}>
            {t('today.addTimetable')}
          </Button>
        }
      />
    </section>
  );
}

interface LessonsProps {
  tt: Timetable;
  now: Date;
  tasks: Task[];
  subjects: Map<string, Subject>;
}

/** Today's lessons while school is on; after the last bell, the next school day's. */
function Lessons({ tt, now, tasks, subjects }: LessonsProps) {
  const { t } = useTranslation();
  const f = useFormat();
  const openSheet = useUI((s) => s.openSheet);
  const { label } = useTaskActions();

  const today = lessonsOnDate(tt, now);
  const schoolOver = today.length > 0 && (today[today.length - 1] as LessonInstance).end <= now;
  const showDay = today.length > 0 && !schoolOver ? now : nextSchoolDay(tt, now);
  const lessons = showDay ? lessonsOnDate(tt, showDay) : [];
  const isToday = showDay != null && toDateKey(showDay) === toDateKey(now);

  const heading = isToday
    ? t('today.lessonsToday')
    : showDay
      ? t('today.lessonsOn', { day: f.relativeDay(toDateKey(showDay), now) })
      : t('today.lessonsToday');

  const firstOfSubject = new Map<string, number>();
  for (const li of lessons) if (!firstOfSubject.has(li.lesson.subjectId)) firstOfSubject.set(li.lesson.subjectId, li.lesson.period);

  return (
    <section aria-labelledby="lessons">
      <SectionLabel id="lessons">{heading}</SectionLabel>
      {!isToday && (
        <p className="mb-2 text-small text-ink-2">{today.length === 0 ? t('today.noSchool') : t('today.doneForToday')}</p>
      )}
      {lessons.length === 0 ? (
        <p className="rounded-lg bg-surface p-4 text-body text-ink-2 shadow-card">{t('today.noLessonsSoon')}</p>
      ) : (
        <ol className="overflow-hidden rounded-lg bg-surface shadow-card" data-testid="lessons">
          {lessons.map((li, i) => {
            const subject = subjects.get(li.lesson.subjectId);
            const due = tasksForLesson(
              tasks,
              li.date,
              li.lesson.subjectId,
              li.lesson.period,
              firstOfSubject.get(li.lesson.subjectId) ?? li.lesson.period,
            );
            const current = li.start <= now && now < li.end;
            const past = li.end <= now;
            const progress = current ? (now.getTime() - li.start.getTime()) / (li.end.getTime() - li.start.getTime()) : 0;
            return (
              <li key={`${li.date}-${li.lesson.period}`} className={cx(subject && `subject-${subject.color}`)}>
                <button
                  type="button"
                  onClick={() => openSheet({ type: 'lesson', date: li.date, day: li.lesson.day, period: li.lesson.period })}
                  aria-current={current ? 'time' : undefined}
                  className={cx(
                    'relative grid min-h-14 w-full grid-cols-lesson items-center gap-3 px-4 py-2 text-left transition-colors duration-fast hover:bg-surface-2',
                    i > 0 && 'border-t border-line',
                    current && 'bg-accent-soft hover:bg-accent-soft',
                  )}
                >
                  <span className={cx('tabular text-small', current ? 'font-semibold text-accent' : 'text-ink-3')}>
                    {li.lesson && tt.bells[li.lesson.period]?.start}
                  </span>
                  <span className="h-8 w-1 rounded-full bg-subj-dot" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className={cx('block truncate text-body font-medium', past ? 'text-ink-3' : 'text-ink')}>
                      {subject?.name ?? '—'}
                      {li.lesson.room && <span className="ml-2 text-small font-normal text-ink-3">{li.lesson.room}</span>}
                    </span>
                    {due.length > 0 && (
                      <span className="block truncate text-small text-ink-2">
                        {due.map((d) => label(d)).join(' · ')}
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-1">
                    {current && (
                      <span className="rounded-full bg-accent px-2 text-caption font-semibold text-accent-fg">{t('today.now')}</span>
                    )}
                    {due.map((d) => (
                      <span
                        key={d.id}
                        title={t(`kind.${d.kind}`)}
                        className={cx('h-2 w-2', d.kind === 'test' ? 'rounded-xs bg-ink' : 'rounded-full border border-ink-2')}
                      />
                    ))}
                  </span>
                  {current && (
                    <span className="absolute inset-x-0 bottom-0 h-1 bg-accent/20" aria-hidden="true">
                      <m.span
                        className="block h-1 origin-left bg-accent"
                        initial={false}
                        animate={{ scaleX: progress }}
                        transition={spring.gentle}
                      />
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function ComingUp({ tasks, subjects, now }: { tasks: Task[]; subjects: Map<string, Subject>; now: Date }) {
  const f = useFormat();
  const openSheet = useUI((s) => s.openSheet);
  const { label } = useTaskActions();
  return (
    <ul className="overflow-hidden rounded-lg bg-surface shadow-card">
      {tasks.slice(0, 6).map((task, i) => {
        const date = fromDateKey(task.due);
        return (
          <li key={task.id}>
            <button
              type="button"
              onClick={() => openSheet({ type: 'task', taskId: task.id })}
              className={cx(
                'flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left transition-colors duration-fast hover:bg-surface-2',
                i > 0 && 'border-t border-line',
              )}
            >
              <span className="flex w-10 shrink-0 flex-col items-center leading-4">
                <span className="text-caption font-semibold uppercase text-ink-3">{f.weekdayShort(date)}</span>
                <span className="tabular text-lead font-semibold text-ink">{f.monthDay(date)}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body text-ink">{label(task)}</span>
                <span className="block text-small text-ink-2">
                  <SubjectTag subject={task.subjectId ? subjects.get(task.subjectId) : undefined} />
                  {!task.subjectId && f.relativeDay(task.due, now)}
                </span>
              </span>
              <KindBadge kind={task.kind} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
