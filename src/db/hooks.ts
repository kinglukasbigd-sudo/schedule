import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import type { Subject, Task, Timetable } from '@/domain/types';
import { db } from './db';

const EMPTY_SUBJECTS: Subject[] = [];
const EMPTY_TASKS: Task[] = [];

/** All subjects, alphabetical, plus a lookup by id. `ready` is false until the first read. */
export function useSubjects() {
  const subjects = useLiveQuery(() => db.subjects.toArray(), []);
  return useMemo(() => {
    const list = (subjects ?? EMPTY_SUBJECTS).slice().sort((a, b) => a.name.localeCompare(b.name));
    return { list, byId: new Map(list.map((s) => [s.id, s])), ready: subjects !== undefined };
  }, [subjects]);
}

/** The timetable, `null` when none exists yet, `undefined` while loading. */
export function useTimetable(): Timetable | null | undefined {
  return useLiveQuery(async () => (await db.timetables.get('main')) ?? null, []);
}

export function useTasks(): { tasks: Task[]; ready: boolean } {
  const tasks = useLiveQuery(() => db.tasks.toArray(), []);
  return useMemo(() => ({ tasks: tasks ?? EMPTY_TASKS, ready: tasks !== undefined }), [tasks]);
}
