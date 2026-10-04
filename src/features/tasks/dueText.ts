import { differenceInCalendarDays } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { fromDateKey, isValidBell } from '@/domain/schedule';
import { isOverdue } from '@/domain/tasks';
import type { Task, Timetable } from '@/domain/types';
import { useFormat } from '@/lib/format';

/**
 * How much of the due moment a row needs to show. Inside a "Tomorrow" group the day is
 * already said by the heading, so only the time remains.
 */
export type DueStyle = 'full' | 'time' | 'long';

/** "Tomorrow · 08:50", "08:50", "Due tomorrow at 08:50 · in 2 days", "Overdue · yesterday". */
export function useDueText() {
  const { t } = useTranslation();
  const f = useFormat();
  return (task: Task, tt: Timetable | null | undefined, now: Date, style: DueStyle = 'full') => {
    const bell = task.period != null ? tt?.bells[task.period] : undefined;
    const time = isValidBell(bell) ? bell.start : null;
    if (task.doneAt == null && isOverdue(task, tt ?? undefined, now)) {
      return { text: t('due.overdue', { day: f.relativeDay(task.due, now, true) }), overdue: true };
    }
    if (style === 'time') return { text: time ?? '', overdue: false };
    if (style === 'full') {
      const day = f.relativeDay(task.due, now);
      return { text: time ? `${day} · ${time}` : day, overdue: false };
    }
    const day = f.relativeDay(task.due, now, true);
    const days = differenceInCalendarDays(fromDateKey(task.due), now);
    const base = time ? t('due.dayTime', { day, time }) : t('due.day', { day });
    return { text: days >= 2 ? `${base} · ${t('due.inDays', { count: days })}` : base, overdue: false };
  };
}
