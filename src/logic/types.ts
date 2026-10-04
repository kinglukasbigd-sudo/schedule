/**
 * TERM 2.0 data model (SPEC §3.1). Every persisted entity lives here; `src/logic` functions are
 * pure and framework-free, and the Dexie schema and stores are built on these types.
 */

// ── Primitives ───────────────────────────────────────────────────────────────

/** Floating local calendar date "yyyy-MM-dd". No time zone (R-1). */
export type DateKey = string & { readonly __brand: 'DateKey' };
/** Floating local wall-clock time "HH:mm", 00:00–23:59. */
export type HHmm = string & { readonly __brand: 'HHmm' };
/** Epoch milliseconds. Audit/ordering only. */
export type Millis = number;
export type ID = string;
/** ISO weekday: 1 = Monday … 7 = Sunday. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const TASK_KINDS = ['homework', 'assignment', 'test'] as const;
export type TaskKind = (typeof TASK_KINDS)[number];

export const ACCENTS = ['blue', 'indigo', 'violet', 'pink', 'red', 'orange', 'green', 'graphite'] as const;
export type Accent = (typeof ACCENTS)[number];
export const THEMES = ['system', 'light', 'dark'] as const;
export type ThemePref = (typeof THEMES)[number];
export const LANGUAGES = ['en', 'mk', 'de'] as const;
export type Language = (typeof LANGUAGES)[number];

export interface Stored {
  id: ID;
  createdAt: Millis;
  updatedAt: Millis;
}

// ── Subjects ─────────────────────────────────────────────────────────────────

export interface Subject extends Stored {
  /** 1–40 chars. Unique by fold(name) (case- and diacritic-insensitive). */
  name: string;
  /** ≤ 4 chars for narrow grids; derived from name when null. */
  short: string | null;
  /** OKLCH hue 0–359 for the pastel generator; null = neutral (stone). */
  hue: number | null;
  teacher: string | null;
}

// ── Timetables ───────────────────────────────────────────────────────────────

export interface Timetable extends Stored {
  /** "Autumn term". Defaults to "Timetable", or "Timetable 2" … */
  name: string;
  /** Inclusive. */
  validFrom: DateKey;
  /** Inclusive; null = open-ended. validTo >= validFrom. */
  validTo: DateKey | null;
  /** School days shown in Week, ascending, at least one. */
  days: Weekday[];
  /** Ordered by start; non-overlapping; 1–14 entries. */
  periods: Period[];
  rotation: Rotation;
  lessons: Lesson[];
}

export interface Period {
  id: ID;
  /** Displayed instead of the ordinal when set, e.g. "0" for an early period. ≤ 3 chars. */
  label: string | null;
  start: HHmm;
  /** end > start. */
  end: HHmm;
}

export interface Rotation {
  /** Weeks in the cycle: 1 = same every week, 2 = A/B, up to 4 (A–D). */
  weeks: 1 | 2 | 3 | 4;
  /** A Monday whose rotation index is `anchorIndex`. */
  anchor: DateKey;
  /** 0 … weeks-1. */
  anchorIndex: number;
  /** Weeks in which every school day is a holiday don't advance the cycle (R-3). */
  skipHolidayWeeks: boolean;
}

export interface Lesson {
  /** Stable across edits of room/length/time/position; a new id when the subject changes (R-4). */
  id: ID;
  subjectId: ID;
  day: Weekday;
  /** Rotation week index, 0 … rotation.weeks-1. */
  week: number;
  /** First period. */
  periodId: ID;
  /** Consecutive periods covered, 1–4. Never runs past the last period. */
  span: number;
  /** Overrides the periods' times for this lesson only (E-7). */
  time: { start: HHmm; end: HHmm } | null;
  room: string | null;
}

// ── Holidays ─────────────────────────────────────────────────────────────────

export interface Holiday extends Stored {
  name: string;
  /** Inclusive range; end >= start. Ranges may overlap (union). */
  start: DateKey;
  end: DateKey;
}

// ── Tasks ────────────────────────────────────────────────────────────────────

export interface Due {
  date: DateKey;
  /** The lesson it is due in. Resolves to that lesson's start on `date` (R-6). */
  lessonId: ID | null;
  /**
   * Explicit time, or a snapshot of the lesson's start taken when the due was set.
   * Used when lessonId is null or no longer resolves on `date`.
   */
  time: HHmm | null;
}

export interface Subtask {
  id: ID;
  title: string;
  done: boolean;
  /** Set for study/work sessions (F-9) and for steps the student scheduled. */
  plannedFor: DateKey | null;
  minutes: number | null;
  origin: 'user' | 'plan';
}

/** Per-task override of the "before due" reminder rules. */
export interface TaskReminder {
  daysBefore: number; // 0–14
  at: HHmm;
}

interface TaskBase extends Stored {
  /** May be empty when a subject is set (label then falls back to the kind: "Math homework"). */
  title: string;
  subjectId: ID | null;
  due: Due;
  notes: string;
  subtasks: Subtask[];
  attachmentIds: ID[];
  /** null = use Settings.reminders. [] = no reminders for this task. */
  reminders: TaskReminder[] | null;
  /** Total effort in minutes; null = default for the kind (R-10). */
  estimateMin: number | null;
  doneAt: Millis | null;
}

export interface Homework extends TaskBase {
  kind: 'homework';
}

export interface Assignment extends TaskBase {
  kind: 'assignment';
  plan: StudyPlan | null;
}

export interface Test extends TaskBase {
  kind: 'test';
  /** Short topic labels, used to title study sessions. */
  topics: string[];
  plan: StudyPlan | null;
  result: TestResult | null;
}

export type Task = Homework | Assignment | Test;

export const SESSION_MINUTES = [15, 25, 45, 60] as const;
export type SessionMinutes = (typeof SESSION_MINUTES)[number];

/** Generator parameters, kept so "Re-plan" reproduces the student's choices. */
export interface StudyPlan {
  generatedAt: Millis;
  sessionMinutes: SessionMinutes;
  sessions: number; // 1–12
}

export interface TestResult {
  /** As written on the paper: "5", "1−", "B+", "13 P". */
  grade: string | null;
  score: number | null;
  outOf: number | null; // > 0 when score is set
  note: string;
  recordedAt: Millis;
}

// ── Attachments ──────────────────────────────────────────────────────────────

export interface Attachment extends Stored {
  taskId: ID;
  name: string;
  mime: string;
  kind: 'image' | 'pdf' | 'file';
  size: number; // bytes, ≤ 10 MB
  blob: Blob;
  /** 256 px JPEG for images and PDF first pages; null for other files. */
  thumb: Blob | null;
}

// ── Reminders ────────────────────────────────────────────────────────────────

export type ReminderRule =
  | { id: ID; type: 'before-due'; enabled: boolean; kinds: TaskKind[]; daysBefore: number; at: HHmm }
  | { id: ID; type: 'study-session'; enabled: boolean } // fires at Settings.study.preferredTime
  | { id: ID; type: 'digest'; enabled: boolean; at: HHmm };

// ── Settings ─────────────────────────────────────────────────────────────────

export interface StudySettings {
  maxMinutesPerDay: number; // 30–240, default 90
  sessionMinutes: SessionMinutes; // default 25
  preferredTime: HHmm; // default 17:00
  weekends: boolean; // default true
}

export interface Settings {
  theme: ThemePref;
  accent: Accent;
  language: Language;
  onboarded: boolean;
  notifications: {
    /** The student turned reminders on (and the OS granted permission). */
    enabled: boolean;
    /** IANA zone the current schedule was computed in; a change triggers rescheduling (E-11). */
    scheduledInZone: string | null;
  };
  reminders: ReminderRule[];
  study: StudySettings;
  lastBackupAt: Millis | null;
}

// ── Import drafts (not stored) ───────────────────────────────────────────────

export interface DraftCell {
  day: Weekday;
  week: number;
  period: number; // index into DraftTimetable.periods
  span: number;
  subject: string;
  room: string | null;
  /** 0–1. Cells under 0.6 are marked "unsure" in review. Typed input = 1. */
  confidence: number;
}

export interface DraftTimetable {
  days: Weekday[];
  weeks: 1 | 2 | 3 | 4;
  periods: { start: HHmm; end: HHmm }[];
  cells: DraftCell[];
  holidays: { name: string; start: DateKey; end: DateKey }[]; // from .ics only
}

// ── Whole data set ───────────────────────────────────────────────────────────

/** Everything stored, as one value: what backups, migrations, seeds and invariants work on. */
export interface AppData {
  settings: Settings;
  subjects: Subject[];
  timetables: Timetable[];
  holidays: Holiday[];
  tasks: Task[];
  attachments: Attachment[];
}

/** The part of AppData that decides when lessons happen. */
export interface Schedule {
  timetables: Timetable[];
  holidays: Holiday[];
}
