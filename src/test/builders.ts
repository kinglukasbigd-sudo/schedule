import { DEFAULT_SETTINGS } from '@/logic/constants';
import { dateKey, hhmm } from '@/logic/time';
import type {
  AppData,
  DateKey,
  Holiday,
  HHmm,
  Lesson,
  Period,
  Schedule,
  Subject,
  Task,
  TaskKind,
  Timetable,
  Weekday,
} from '@/logic/types';

/** Builders for v2 data in tests. Dates in examples follow DESIGN's 2026 calendar (5 Oct = Monday). */
export const k = (s: string): DateKey => dateKey(s);
export const t = (s: string): HHmm => hhmm(s);
/** An instant from a local wall-clock time, e.g. at('2026-10-05 09:10'). */
export const at = (s: string): Date => {
  const [d, time = '00:00'] = s.split(' ');
  const [y, m, day] = (d as string).split('-').map(Number) as [number, number, number];
  const [h, min] = time.split(':').map(Number) as [number, number];
  return new Date(y, m - 1, day, h, min);
};

/** 45-minute periods from 08:00, 5-minute breaks, 20 minutes after period 3. */
export const PERIODS: Period[] = [
  ['08:00', '08:45'],
  ['08:50', '09:35'],
  ['09:40', '10:25'],
  ['10:45', '11:30'],
  ['11:35', '12:20'],
  ['12:25', '13:10'],
  ['13:15', '14:00'],
].map(([start, end], i) => ({ id: `p${i + 1}`, label: null, start: t(start as string), end: t(end as string) }));

export function subject(id: string, name: string, hue: number | null = 235): Subject {
  return { id, name, short: null, hue, teacher: null, createdAt: 1, updatedAt: 1 };
}

export const SUBJECTS: Subject[] = [
  subject('math', 'Mathematics', 235),
  subject('eng', 'English', 5),
  subject('bio', 'Biology', 160),
  subject('pe', 'Physical Education', 75),
  subject('de', 'Deutsch', 300),
  subject('chem', 'Chemistry', 190),
];

let lessonSeq = 0;
/** Lessons from subject ids per weekday, one per period starting at period 1 ('' = free period). */
export function lessonsFrom(week: Partial<Record<Weekday, string[]>>, rotationWeek = 0): Lesson[] {
  return Object.entries(week).flatMap(([day, ids]) =>
    (ids ?? []).flatMap((subjectId, i): Lesson[] =>
      subjectId
        ? [
            {
              id: `${subjectId}-${day}-${i + 1}-w${rotationWeek}-${++lessonSeq}`,
              subjectId,
              day: Number(day) as Weekday,
              week: rotationWeek,
              periodId: `p${i + 1}`,
              span: 1,
              time: null,
              room: null,
            },
          ]
        : [],
    ),
  );
}

export function lesson(partial: Partial<Lesson> & Pick<Lesson, 'subjectId' | 'day' | 'periodId'>): Lesson {
  return { id: `l${++lessonSeq}`, week: 0, span: 1, time: null, room: null, ...partial };
}

/** Mon–Fri timetable: Math first thing Monday and in period 6, Biology double on Wednesday, … */
export const SAMPLE_WEEK: Partial<Record<Weekday, string[]>> = {
  1: ['math', 'eng', 'bio', 'bio', 'pe', 'math'],
  2: ['eng', 'math', 'de', 'pe'],
  3: ['chem', 'math', 'eng', 'de', 'de'],
  4: ['de', 'eng', 'math'],
  5: ['pe', 'bio', 'math', 'eng'],
};

export function timetable(partial: Partial<Timetable> = {}): Timetable {
  return {
    id: 'tt1',
    name: 'Timetable',
    validFrom: k('2026-09-01'),
    validTo: null,
    days: [1, 2, 3, 4, 5],
    periods: PERIODS,
    rotation: { weeks: 1, anchor: k('2026-08-31'), anchorIndex: 0, skipHolidayWeeks: false },
    lessons: lessonsFrom(SAMPLE_WEEK),
    createdAt: 1,
    updatedAt: 1,
    ...partial,
  };
}

export function holiday(name: string, start: string, end = start): Holiday {
  return { id: `h-${name}-${start}`, name, start: k(start), end: k(end), createdAt: 1, updatedAt: 1 };
}

export const schedule = (timetables: Timetable[] = [timetable()], holidays: Holiday[] = []): Schedule => ({
  timetables,
  holidays,
});

let taskSeq = 0;
type TaskInit = Partial<Omit<Task, 'kind' | 'due'>> & { kind?: TaskKind; due: string | Task['due'] };
export function task(init: TaskInit): Task {
  taskSeq++;
  const { kind = 'homework', due, ...rest } = init;
  const base = {
    id: `task${taskSeq}`,
    title: `Task ${taskSeq}`,
    subjectId: null,
    due: typeof due === 'string' ? { date: k(due), lessonId: null, time: null } : due,
    notes: '',
    subtasks: [],
    attachmentIds: [],
    reminders: null,
    estimateMin: null,
    doneAt: null,
    createdAt: taskSeq,
    updatedAt: taskSeq,
    ...rest,
  };
  if (kind === 'test') return { topics: [], plan: null, result: null, ...base, kind } as Task;
  if (kind === 'assignment') return { plan: null, ...base, kind } as Task;
  return { ...base, kind } as Task;
}

export function appData(partial: Partial<AppData> = {}): AppData {
  return {
    settings: { ...DEFAULT_SETTINGS, onboarded: true },
    subjects: SUBJECTS,
    timetables: [timetable()],
    holidays: [],
    tasks: [],
    attachments: [],
    ...partial,
  };
}
