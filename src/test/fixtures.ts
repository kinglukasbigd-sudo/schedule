import { defaultBells } from '@/domain/schedule';
import type { Lesson, Subject, Task, Timetable, Weekday } from '@/domain/types';

export const subjects: Subject[] = [
  { id: 'math', name: 'Mathematics', color: 'sky', createdAt: 1 },
  { id: 'eng', name: 'English', color: 'rose', createdAt: 2 },
  { id: 'bio', name: 'Biology', color: 'mint', createdAt: 3 },
  { id: 'pe', name: 'Physical Education', color: 'amber', createdAt: 4 },
  { id: 'de', name: 'Deutsch', color: 'lilac', createdAt: 5 },
];

/** Mon–Fri, 7 periods from 08:00 (45 min, long break after period 3). */
const week: Record<number, string[]> = {
  1: ['math', 'eng', 'bio', 'bio', 'pe'],
  2: ['eng', 'math', 'de', 'pe'],
  3: ['bio', 'math', 'eng', 'de', 'de', 'math'],
  4: ['de', 'eng', 'math'],
  5: ['pe', 'bio', 'math', 'eng'],
};

export const timetable: Timetable = {
  id: 'main',
  days: [1, 2, 3, 4, 5],
  bells: defaultBells(7),
  lessons: Object.entries(week).flatMap(([day, ids]) =>
    ids.map((subjectId, period): Lesson => ({ day: Number(day) as Weekday, period, subjectId })),
  ),
  updatedAt: 0,
};

let seq = 0;
export function task(partial: Partial<Task> & Pick<Task, 'due'>): Task {
  seq++;
  return {
    id: `t${seq}`,
    kind: 'homework',
    title: `Task ${seq}`,
    subjectId: null,
    period: null,
    notes: '',
    doneAt: null,
    createdAt: seq,
    updatedAt: seq,
    ...partial,
  };
}

/** 2026-10-05 is a Monday. */
export const at = (iso: string) => new Date(iso);
