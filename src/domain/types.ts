/**
 * The shapes the v1 screens work with. Stored data is the v2 model in `@/logic/types`; the
 * screens get these views of it through `@/db/hooks` and `@/db/legacy` until they are rebuilt
 * on the v2 model (D-045). Shared definitions come from the v2 model.
 */
export {
  ACCENTS,
  LANGUAGES,
  TASK_KINDS,
  THEMES,
  type Accent,
  type Language,
  type Settings,
  type TaskKind,
  type ThemePref,
  type Weekday,
} from '@/logic/types';
export { DEFAULT_SETTINGS } from '@/logic/constants';
import type { TaskKind, Weekday } from '@/logic/types';

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
