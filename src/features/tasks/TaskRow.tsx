import { m } from 'framer-motion';
import { useState } from 'react';
import { Checkbox } from '@/components/Checkbox';
import { KindBadge, SubjectTag } from '@/components/SubjectBadge';
import type { Subject, Task, Timetable } from '@/domain/types';
import { cx } from '@/lib/cx';
import { spring } from '@/lib/motion';
import { useUI } from '@/state/ui';
import { useDueText, type DueStyle } from './dueText';
import { useTaskActions } from './useTaskActions';
import { useTranslation } from 'react-i18next';

interface TaskRowProps {
  task: Task;
  subject: Subject | undefined;
  tt: Timetable | null | undefined;
  now: Date;
  /** Hide the due label (e.g. inside a lesson sheet where the date is implied). */
  hideDue?: boolean;
  /** Hide the subject (e.g. inside a lesson sheet that is about that subject). */
  hideSubject?: boolean;
  dueStyle?: DueStyle;
  last?: boolean;
}

export function TaskRow({ task, subject, tt, now, hideDue, hideSubject, dueStyle = 'full', last }: TaskRowProps) {
  const { t } = useTranslation();
  const openSheet = useUI((s) => s.openSheet);
  const { complete, reopen, label } = useTaskActions();
  const dueText = useDueText();
  const done = task.doneAt != null;
  // Show the tick immediately, then let the row leave the list.
  const [checking, setChecking] = useState(false);
  const checked = done || checking;
  const due = dueText(task, tt, now, dueStyle);

  const toggle = (next: boolean) => {
    if (!next) return void reopen(task);
    setChecking(true);
    setTimeout(() => void complete(task).finally(() => setChecking(false)), 280);
  };

  return (
    <m.li
      layout="position"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={spring.gentle}
      className="overflow-hidden"
      data-testid="task-row"
    >
      <div className="flex items-start gap-3 pl-4">
        <div className="pt-3">
          <Checkbox
            checked={checked}
            onChange={toggle}
            kind={task.kind}
            label={t(done ? 'tasks.markOpen' : 'tasks.markDone', { title: label(task) })}
          />
        </div>
        <button
          type="button"
          onClick={() => openSheet({ type: 'task', taskId: task.id })}
          className={cx('min-w-0 flex-1 py-3 pr-4 text-left', !last && 'border-b border-line')}
        >
          <span
            className={cx(
              'line-clamp-2 block text-body transition-colors duration-fast',
              checked ? 'text-ink-3 line-through' : 'text-ink',
            )}
          >
            {label(task)}
          </span>
          <span className="mt-1 flex min-w-0 items-center gap-2 text-small text-ink-2">
            {!hideSubject && <SubjectTag subject={subject} />}
            {task.title && <KindBadge kind={task.kind} />}
            {!hideDue && due.text && (
              <span className={cx('ml-auto shrink-0 tabular', due.overdue && !done ? 'text-danger' : 'text-ink-3')}>
                {due.text}
              </span>
            )}
          </span>
        </button>
      </div>
    </m.li>
  );
}
