import { AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { Sheet } from '@/components/Sheet';
import { useSubjects, useTasks, useTimetable } from '@/db/hooks';
import { fromDateKey, isValidBell, lessonAt, lessonsOnDate } from '@/domain/schedule';
import { tasksForLesson } from '@/domain/tasks';
import { TaskRow } from '@/features/tasks/TaskRow';
import { useFormat } from '@/lib/format';
import { useNow } from '@/lib/useNow';
import { useUI, type Sheet as SheetState } from '@/state/ui';

type LessonState = Extract<SheetState, { type: 'lesson' }>;

/** One lesson on one date: what's due then, and a one-tap way to add more. */
export function LessonSheet({ state, open }: { state: LessonState | null; open: boolean }) {
  const { t } = useTranslation();
  const f = useFormat();
  const now = useNow();
  const tt = useTimetable();
  const { byId } = useSubjects();
  const { tasks } = useTasks();
  const close = useUI((s) => s.closeSheet);
  const openSheet = useUI((s) => s.openSheet);

  const lesson = state ? lessonAt(tt ?? undefined, state.day, state.period) : undefined;
  const subject = lesson ? byId.get(lesson.subjectId) : undefined;
  const bell = state ? tt?.bells[state.period] : undefined;
  const firstPeriod =
    state && lesson
      ? (lessonsOnDate(tt ?? undefined, fromDateKey(state.date)).find((li) => li.lesson.subjectId === lesson.subjectId)?.lesson
          .period ?? state.period)
      : 0;
  const due = state && lesson ? tasksForLesson(tasks, state.date, lesson.subjectId, state.period, firstPeriod) : [];

  const meta = [
    state ? f.relativeDay(state.date, now) : '',
    isValidBell(bell) ? `${bell.start}–${bell.end}` : '',
    lesson?.room ? t('lesson.room', { room: lesson.room }) : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Sheet
      open={open}
      onClose={close}
      eyebrow={meta}
      title={
        <span className={`subject-${subject?.color ?? 'stone'} inline-flex items-center gap-2`}>
          <span className="h-3 w-3 rounded-full bg-subj-dot" aria-hidden="true" />
          {subject?.name ?? t('lesson.free')}
        </span>
      }
      testId="lesson-sheet"
      footer={
        lesson && state ? (
          <Button
            variant="primary"
            size="lg"
            block
            icon="plus"
            data-autofocus
            onClick={() =>
              openSheet({ type: 'task', preset: { subjectId: lesson.subjectId, due: state.date, period: state.period } })
            }
          >
            {t('lesson.addForLesson')}
          </Button>
        ) : undefined
      }
    >
      {due.length > 0 ? (
        <ul className="-mx-4" aria-label={t('lesson.dueHere')}>
          <AnimatePresence initial={false}>
            {due.map((task, i) => (
              <TaskRow key={task.id} task={task} subject={subject} tt={tt} now={now} hideDue hideSubject last={i === due.length - 1} />
            ))}
          </AnimatePresence>
        </ul>
      ) : (
        <p className="py-4 text-body text-ink-2">{t('lesson.nothingDue')}</p>
      )}
    </Sheet>
  );
}
