import type { HHmm, ReminderRule, Settings, TaskKind } from './types';

/** SPEC §3.2. */
export const LEAD_DAYS: Record<TaskKind, number> = { homework: 0, test: 2, assignment: 3 };
/** Lower = more important. */
export const KIND_WEIGHT: Record<TaskKind, number> = { test: 0, assignment: 1, homework: 2 };
export const DEFAULT_ESTIMATE_MIN: Record<TaskKind, number> = { homework: 30, test: 120, assignment: 240 };
export const END_OF_DAY = '23:59' as HHmm;
export const NIGHT_OWL_UNTIL = '04:00' as HHmm;
export const NEXT_LESSON_HORIZON_DAYS = 120;
export const COMING_UP_DAYS = 14;
export const MAX_PERIODS = 14;
export const MAX_SPAN = 4;
export const MAX_ROTATION = 4;
export const MAX_ATTACHMENT_BYTES = 10_485_760;
export const NOTIFICATION_BUDGET = 60;
export const SNACKBAR_MS = 6000;

/** Study plans look back at most this many days from the due date (R-11). */
export const PLAN_WINDOW_DAYS = 14;
export const MAX_PLAN_SESSIONS = 12;
/** Calendar export covers this many weeks (D-023). */
export const ICS_WEEKS = 26;

/** F-11 defaults: homework 1 day before 18:00; tests 3 and 1 days before; assignments 2 days before. */
export const DEFAULT_REMINDERS: ReminderRule[] = [
  { id: 'homework-1d', type: 'before-due', enabled: true, kinds: ['homework'], daysBefore: 1, at: '18:00' as HHmm },
  { id: 'test-3d', type: 'before-due', enabled: true, kinds: ['test'], daysBefore: 3, at: '18:00' as HHmm },
  { id: 'test-1d', type: 'before-due', enabled: true, kinds: ['test'], daysBefore: 1, at: '18:00' as HHmm },
  { id: 'assignment-2d', type: 'before-due', enabled: true, kinds: ['assignment'], daysBefore: 2, at: '18:00' as HHmm },
  { id: 'study-session', type: 'study-session', enabled: true },
  { id: 'digest', type: 'digest', enabled: false, at: '20:00' as HHmm },
];

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  accent: 'blue',
  language: 'en',
  onboarded: false,
  notifications: { enabled: false, scheduledInZone: null },
  reminders: DEFAULT_REMINDERS,
  study: { maxMinutesPerDay: 90, sessionMinutes: 25, preferredTime: '17:00' as HHmm, weekends: true },
  lastBackupAt: null,
};
