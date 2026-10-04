import { addDays } from 'date-fns';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Icon } from '@/components/Icon';
import { Segmented } from '@/components/Segmented';
import { Sheet } from '@/components/Sheet';
import { useSubjects, useTasks, useTimetable } from '@/db/hooks';
import { addTask, createSubject, updateTask, type TaskInput } from '@/db/repo';
import { parseQuickAdd, stripDate } from '@/domain/quickAdd';
import { fromDateKey, isValidBell, lessonOfSubjectOn, nextLessonOfSubject, toDateKey } from '@/domain/schedule';
import { TASK_KINDS, type Task, type TaskKind, type Timetable } from '@/domain/types';
import { useTaskActions } from '@/features/tasks/useTaskActions';
import { cx } from '@/lib/cx';
import { useFormat } from '@/lib/format';
import { useNow } from '@/lib/useNow';
import { useUI, type Sheet as SheetState } from '@/state/ui';

type TaskSheetState = Extract<SheetState, { type: 'task' }>;

interface Due {
  date: string;
  period: number | null;
}

/** Due moment for a subject on a date: its lesson that day if it has one. */
function dueOn(tt: Timetable | null | undefined, subjectId: string | null, date: string): Due {
  const li = subjectId ? lessonOfSubjectOn(tt ?? undefined, subjectId, fromDateKey(date)) : null;
  return { date, period: li ? li.lesson.period : null };
}

export function TaskSheet({ state, open, seq }: { state: TaskSheetState | null; open: boolean; seq: number }) {
  const { t } = useTranslation();
  const close = useUI((s) => s.closeSheet);
  const { tasks, ready } = useTasks();
  const editing = !!state?.taskId;
  const task = state?.taskId ? (tasks.find((t) => t.id === state.taskId) ?? null) : null;

  return (
    <Sheet
      open={open}
      onClose={close}
      title={editing ? t('taskSheet.editTitle') : t('taskSheet.newTitle')}
      testId="task-sheet"
    >
      {state && ready && <TaskForm key={seq} preset={state.preset} task={task ?? null} onDone={close} />}
    </Sheet>
  );
}

function TaskForm({ preset, task, onDone }: { preset?: Partial<TaskInput>; task: Task | null; onDone: () => void }) {
  const { t } = useTranslation();
  const f = useFormat();
  const now = useNow();
  const tt = useTimetable();
  const { list: subjects, byId } = useSubjects();
  const showToast = useUI((s) => s.showToast);
  const { remove } = useTaskActions();

  const [title, setTitle] = useState(task?.title ?? preset?.title ?? '');
  const [notes, setNotes] = useState(task?.notes ?? preset?.notes ?? '');
  const [showNotes, setShowNotes] = useState(!!(task?.notes || preset?.notes));
  const [newSubject, setNewSubject] = useState<string | null>(null);

  // Fields the user set explicitly. Anything not set here follows quick-add hints, then defaults.
  const [manual, setManual] = useState<{ kind?: TaskKind; subjectId?: string | null; due?: Due }>(() =>
    task
      ? { kind: task.kind, subjectId: task.subjectId, due: { date: task.due, period: task.period } }
      : {
          ...(preset?.kind ? { kind: preset.kind } : {}),
          ...(preset?.subjectId !== undefined ? { subjectId: preset.subjectId } : {}),
          ...(preset?.due ? { due: { date: preset.due, period: preset.period ?? null } } : {}),
        },
  );

  const hints = useMemo(() => (task ? {} : parseQuickAdd(title, subjects, now)), [task, title, subjects, now]);
  const kind: TaskKind = manual.kind ?? hints.kind ?? 'homework';
  const subjectId: string | null = manual.subjectId !== undefined ? manual.subjectId : (hints.subjectId ?? null);

  const next = subjectId ? nextLessonOfSubject(tt ?? undefined, subjectId, now) : null;
  const nextDue: Due | null = next ? { date: next.date, period: next.lesson.period } : null;
  const tomorrow = toDateKey(addDays(now, 1));
  const due: Due = manual.due ?? (hints.date ? dueOn(tt, subjectId, hints.date) : (nextDue ?? { date: tomorrow, period: null }));

  const isNext = !!nextDue && due.date === nextDue.date && due.period === nextDue.period;
  // When the next lesson is tomorrow, a separate "Tomorrow" chip would say the same thing.
  const showTomorrow = nextDue?.date !== tomorrow;
  const isTomorrow = !isNext && showTomorrow && due.date === tomorrow;
  const isCustom = !isNext && !isTomorrow;
  const bell = due.period != null ? tt?.bells[due.period] : undefined;
  const subject = subjectId ? byId.get(subjectId) : undefined;
  const canSave = title.trim().length > 0 || subjectId != null;

  // Keep the chosen subject visible when quick-add picks one off-screen.
  const chips = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!subjectId) return;
    // Scroll only the chip row (scrollIntoView would also scroll the sheet sideways).
    const row = chips.current;
    const chip = row?.querySelector<HTMLElement>(`[data-subject-id="${subjectId}"]`);
    if (!row || !chip) return;
    const left = chip.offsetLeft; // the row is the offsetParent (relative)
    if (left >= row.scrollLeft && left + chip.offsetWidth <= row.scrollLeft + row.clientWidth) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    row.scrollTo({ left: Math.max(0, left - 16), behavior: reduce ? 'auto' : 'smooth' });
  }, [subjectId]);

  const save = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!canSave) return;
    // Date words typed into the title ("… friday") go stale when the due date moves, so drop them.
    const cleanTitle = hints.date ? stripDate(title) : title;
    const input: TaskInput = { kind, title: cleanTitle, subjectId, due: due.date, period: due.period, notes: notes.trim() };
    if (task) {
      await updateTask(task.id, input);
    } else {
      await addTask(input);
      showToast({ message: t('toast.added', { day: f.relativeDay(due.date, now, true) }) });
    }
    onDone();
  };

  const addSubject = async () => {
    const name = newSubject?.trim();
    if (!name) return setNewSubject(null);
    const s = await createSubject(name);
    setManual((m) => ({ ...m, subjectId: s.id }));
    setNewSubject(null);
  };

  return (
    <form onSubmit={save} className="flex flex-col gap-4" noValidate>
      <Segmented
        label={t('taskSheet.kind')}
        value={kind}
        onChange={(k) => setManual((m) => ({ ...m, kind: k }))}
        options={TASK_KINDS.map((k) => ({ value: k, label: t(`kind.${k}`) }))}
      />

      <div>
        <label htmlFor="task-title" className="sr-only">
          {t('taskSheet.titleLabel')}
        </label>
        <input
          id="task-title"
          data-autofocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t(`taskSheet.placeholder.${kind}`)}
          autoComplete="off"
          enterKeyHint="done"
          className="w-full rounded-md bg-surface-2 px-4 py-3 text-lead text-ink placeholder:text-ink-3"
        />
        {!task && !title && <p className="mt-2 text-caption text-ink-3">{t('taskSheet.tip')}</p>}
      </div>

      <fieldset>
        <legend className="mb-1 text-caption font-semibold uppercase tracking-wide text-ink-3">{t('taskSheet.subject')}</legend>
        <div ref={chips} className="scrollbar-none relative -mx-4 flex gap-2 overflow-x-auto px-4" data-testid="subject-chips">
          {subjects.map((s) => (
            <Chip
              key={s.id}
              data-subject-id={s.id}
              subject={s.color}
              selected={s.id === subjectId}
              onClick={() => setManual((m) => ({ ...m, subjectId: s.id === subjectId ? null : s.id }))}
            >
              {s.name}
            </Chip>
          ))}
          {newSubject == null ? (
            <Chip onClick={() => setNewSubject('')}>
              <Icon name="plus" size={16} />
              {t('taskSheet.newSubject')}
            </Chip>
          ) : (
            <div className="flex min-h-11 shrink-0 items-center">
              <input
                autoFocus
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                onBlur={() => void addSubject()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void addSubject();
                  }
                  if (e.key === 'Escape') {
                    e.stopPropagation();
                    setNewSubject(null);
                  }
                }}
                aria-label={t('taskSheet.newSubject')}
                placeholder={t('taskSheet.newSubjectPlaceholder')}
                className="h-9 w-40 rounded-full bg-surface-2 px-4 text-body"
              />
            </div>
          )}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1 text-caption font-semibold uppercase tracking-wide text-ink-3">{t('taskSheet.due')}</legend>
        <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4">
          {nextDue && (
            <Chip selected={isNext} onClick={() => setManual((m) => ({ ...m, due: nextDue }))}>
              {t('taskSheet.nextLesson', { day: f.relativeDay(nextDue.date, now, true) })}
            </Chip>
          )}
          {showTomorrow && (
            <Chip selected={isTomorrow} onClick={() => setManual((m) => ({ ...m, due: dueOn(tt, subjectId, tomorrow) }))}>
              {t('time.tomorrow')}
            </Chip>
          )}
          <label className="group relative flex min-h-11 shrink-0 cursor-pointer items-center">
            <span
              className={cx(
                'flex h-9 items-center gap-2 rounded-full px-4 text-small font-medium transition-colors duration-fast',
                isCustom ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-ink-2 group-hover:bg-surface-3',
              )}
            >
              <Icon name="calendar" size={16} />
              {isCustom ? f.relativeDay(due.date, now) : t('taskSheet.pickDate')}
            </span>
            <input
              type="date"
              value={due.date}
              min={toDateKey(addDays(now, -365))}
              onChange={(e) => e.target.value && setManual((m) => ({ ...m, due: dueOn(tt, subjectId, e.target.value) }))}
              aria-label={t('taskSheet.pickDate')}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
        </div>
        <p className="mt-2 flex items-center gap-2 text-small text-ink-2" data-testid="due-summary">
          <Icon name="clock" size={16} className="shrink-0 text-ink-3" />
          <span className="truncate">
            {f.fullDate(fromDateKey(due.date))}
            {isValidBell(bell) && subject ? ` · ${t('taskSheet.atLesson', { subject: subject.name, time: bell.start })}` : ''}
          </span>
        </p>
      </fieldset>

      {showNotes ? (
        <div>
          <label htmlFor="task-notes" className="mb-1 block text-caption font-semibold uppercase tracking-wide text-ink-3">
            {t('taskSheet.notes')}
          </label>
          <textarea
            id="task-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            autoFocus={!task?.notes}
            className="w-full resize-none rounded-md bg-surface-2 px-4 py-3 text-body text-ink placeholder:text-ink-3"
            placeholder={t('taskSheet.notesPlaceholder')}
          />
        </div>
      ) : (
        <Button variant="ghost" icon="note" onClick={() => setShowNotes(true)} className="-ml-2 self-start">
          {t('taskSheet.addNote')}
        </Button>
      )}

      <div className="flex items-center gap-2 pt-2">
        {task && (
          <Button
            variant="danger"
            icon="trash"
            onClick={() => {
              void remove(task);
              onDone();
            }}
          >
            {t('common.delete')}
          </Button>
        )}
        <Button type="submit" variant="primary" size="lg" disabled={!canSave} className="flex-1" data-testid="task-save">
          {task ? t('common.save') : t(`taskSheet.add.${kind}`)}
        </Button>
      </div>
    </form>
  );
}
