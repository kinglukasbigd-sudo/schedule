/** ISO weekday: 1 = Monday … 7 = Sunday. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const TASK_KINDS = ['homework', 'assignment', 'test'] as const;
export type TaskKind = (typeof TASK_KINDS)[number];

export const SUBJECT_COLORS = [
  'sky',
  'rose',
  'mint',
  'amber',
  'lilac',
  'coral',
  'teal',
  'iris',
  'lime',
  'orchid',
  'stone',
] as const;
export type SubjectColor = (typeof SUBJECT_COLORS)[number];

export const ACCENTS = ['blue', 'indigo', 'violet', 'pink', 'red', 'orange', 'green', 'graphite'] as const;
export type Accent = (typeof ACCENTS)[number];

export const THEMES = ['system', 'light', 'dark'] as const;
export type ThemePref = (typeof THEMES)[number];

export const LANGUAGES = ['en', 'mk', 'de'] as const;
export type Language = (typeof LANGUAGES)[number];

export interface Subject {
  id: string;
  name: string;
  color: SubjectColor;
  createdAt: number;
}

/** A slot in the bell schedule, times as "HH:mm". */
export interface Bell {
  start: string;
  end: string;
}

export interface Lesson {
  day: Weekday;
  /** Index into Timetable.bells. */
  period: number;
  subjectId: string;
  room?: string;
}

export interface Timetable {
  id: 'main';
  days: Weekday[];
  bells: Bell[];
  lessons: Lesson[];
  updatedAt: number;
}

export interface Task {
  id: string;
  kind: TaskKind;
  title: string;
  subjectId: string | null;
  /** Due date as "yyyy-MM-dd" (local). */
  due: string;
  /** Period on the due date the task is due for, or null for "end of day". */
  period: number | null;
  notes: string;
  doneAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface Settings {
  theme: ThemePref;
  accent: Accent;
  language: Language;
  onboarded: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  accent: 'blue',
  language: 'en',
  onboarded: false,
};

/** A timetable as it comes out of an importer, before subjects exist in the database. */
export interface DraftCell {
  day: Weekday;
  period: number;
  subject: string;
  room?: string;
}

export interface DraftTimetable {
  days: Weekday[];
  bells: Bell[];
  cells: DraftCell[];
}
