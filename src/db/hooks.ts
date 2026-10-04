import { useMemo } from 'react';
import type { Subject, Task, Timetable } from '@/domain/types';
import { useData } from '@/state/data';
import { currentTimetable, subjectView, taskView, timetableView, todayKey, viewWeek } from './legacy';

/**
 * v1 screen hooks over the v2 data store (D-045). They return the old shapes, derived from the
 * store, so every write shows up in the same frame.
 */

/** All subjects, alphabetical, plus a lookup by id. `ready` is false until the first read. */
export function useSubjects() {
  const subjects = useData((s) => s.subjects);
  const ready = useData((s) => s.ready);
  return useMemo(() => {
    const list: Subject[] = subjects.map(subjectView).sort((a, b) => a.name.localeCompare(b.name));
    return { list, byId: new Map(list.map((s) => [s.id, s])), ready };
  }, [subjects, ready]);
}

/** The current timetable, `null` when none exists yet, `undefined` while loading. */
export function useTimetable(): Timetable | null | undefined {
  const timetables = useData((s) => s.timetables);
  const holidays = useData((s) => s.holidays);
  const ready = useData((s) => s.ready);
  const today = todayKey();
  return useMemo(() => {
    if (!ready) return undefined;
    const t = currentTimetable(timetables, today);
    return t ? timetableView(t, viewWeek(t, holidays, today)) : null;
  }, [timetables, holidays, ready, today]);
}

export function useTasks(): { tasks: Task[]; ready: boolean } {
  const tasks = useData((s) => s.tasks);
  const timetables = useData((s) => s.timetables);
  const ready = useData((s) => s.ready);
  return useMemo(() => ({ tasks: tasks.map((t) => taskView(t, timetables)), ready }), [tasks, timetables, ready]);
}
