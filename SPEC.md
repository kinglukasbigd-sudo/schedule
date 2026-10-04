# TERM — Product spec

> A minimalist, offline-first school planner. A student gets their timetable in within
> 60 seconds, then homework, assignments and tests organise themselves around it.
> The app always answers one question: **what do I need to do next?**

| | |
| --- | --- |
| Status | Target spec for TERM 2.0. Supersedes the v1 spec. |
| Companion docs | `DESIGN.md` (tokens, components, wireframes), `DECISIONS.md` (why things are the way they are) |
| Language | **MUST** = required for release. **SHOULD** = required unless a decision in `DECISIONS.md` says otherwise. **MAY** = optional. |
| IDs | Features `F-x`, rules `R-x`, edge cases `E-x`, non-functional `N-x`. Tests and commits reference them. |

The repository already contains a working v1 (one timetable, three tabs, no rotation). Section 9
lists every difference between v1 and this spec and how stored data migrates.

---

## 0. Glossary

| Term | Meaning |
| --- | --- |
| **Timetable** | A repeating school week (or 2–4 week cycle) valid between two dates. A student can have several (e.g. autumn and spring term). |
| **Period** | A numbered slot in the bell schedule, e.g. *Period 3, 09:45–10:30*. Belongs to one timetable. |
| **Lesson** | A subject placed on a weekday, in a rotation week, starting at a period, spanning one or more periods. |
| **Occurrence** | A lesson on a concrete date, with real start and end times. Derived, never stored. |
| **Rotation week** | Which week of the cycle a date falls in: always *A* for a 1-week cycle; *A/B* for 2 weeks, and so on. |
| **School day** | A date with at least one occurrence (not a weekend, not a holiday, inside a timetable's range). |
| **Holiday** | A date range without school. Removes all occurrences in that range. |
| **Task** | Homework, an assignment or a test. One model, three kinds. |
| **Due moment** | The instant a task is due: the start of its lesson occurrence, an explicit time, or end of day (R-6). |
| **Lead time** | How many days before the due moment a task starts competing for *Next up* (R-8). |
| **Study session** | A planned step of a test or assignment, with a date and a duration (F-9). |
| **Load** | Estimated minutes of work allocated to a date; drives the heatmap (R-10). |
| **Date key** | A floating local calendar date `yyyy-MM-dd`. **Times are floating wall-clock times**: no time zone is stored (R-1). |

---

## 1. Product

### 1.1 Summary

TERM is a phone-first planner for school students. It has no account and no server: everything
lives on the device and works offline. Setup is a photo, screenshot or PDF of the timetable (read
on-device), or typing one line per day. From then on the timetable is the backbone: new homework
defaults to *the next lesson of that subject*, tests surface days ahead with a study plan, and the
home screen shows the single most urgent thing.

### 1.2 Target user

School students aged **12–19**, phone-first (≈ 90 % of sessions on a phone, often one-handed,
between lessons, in under 20 seconds). Secondary: tablets and laptops at home.

| Persona | Context | What TERM must get right |
| --- | --- | --- |
| **Mila, 13, Skopje (MK)** | Morning/afternoon shifts, 7 periods, teacher writes homework on the board. Phone in Macedonian. | Cyrillic OCR, typing "домашна по англиски утре", big friendly targets, no account. |
| **Jonas, 17, Munich (DE)** | Oberstufe: double lessons, A/B weeks, Klausuren announced weeks ahead, holidays per Bundesland. | Lessons spanning periods, A/B rotation, study plans, holiday ranges, `.ics` into his calendar. |
| **Sara, 15, London (EN)** | Two-week timetable, changes at term boundary, lots of assignments. | Multiple timetables with date ranges, assignment work plans, reminders. |

Constraints that follow from the age group: no sign-up, no personal data collection, no ads,
no social features, no third-party network calls by default (N-6). Parents and teachers are not users.

### 1.3 Jobs and success criteria

| Job | Success looks like |
| --- | --- |
| Get my timetable in | First launch → filled week grid in **≤ 60 s** (median), by photo/screenshot/PDF/calendar file or typing. |
| Capture homework fast | `+` → type "math ex 4–7" → *Add*. **2 taps.** Due date defaults to the next Math lesson. |
| Know what's next | Opening the app shows *Next up* above the fold, today's lessons and what's coming. |
| Not be surprised by tests | Tests surface ≥ 2 days early (lead time), get a study plan in one tap, and remind me the evening before. |
| See busy days coming | The week view and date picker show load per day; the study planner avoids overloaded days. |
| Keep my data | Export everything to one file; export lessons and tests to my calendar. |

### 1.4 Non-goals (v2)

Accounts, cloud sync, sharing between students, teacher/parent features, grade averages or GPA,
per-date substitutions (cancelled lesson, room change for one day), absence tracking, chat, ads,
streaks/gamification, search (lists are short; *Tasks* is the index). Each was considered; see
`DECISIONS.md` D-020.

---

## 2. Features

Every feature lists what it **MUST** do. Interaction and visuals are in `DESIGN.md`.

### F-1 Schedule onboarding

First run only; reachable later from *Settings → Timetables → Add timetable*.

1. **Welcome** — one sentence, one primary button (*Add my timetable*), secondary *Start empty*,
   language switch (EN/MK/DE, preselected from the device).
2. **Method** — three options, one emphasised:
   - *Photo, screenshot or PDF* (primary). On phones this opens the system picker (camera, photo
     library, files).
   - *Type it in* → Manual builder.
   - *Calendar or backup file* (`.ics` → F-12 calendar import; `.json` → F-12 restore).
3. **Importing** — runs entirely on-device (R-13): PDF text layer (pdf.js) or OCR (Tesseract, with
   bundled EN/DE/MK language data) → layout parser → draft timetable. Shows phase and progress, is
   cancellable, never takes longer than 30 s without showing progress. Failure returns to *Method*
   with a friendly reason and *Type it in* as the obvious next step.
4. **Manual builder** — one field per school day, subjects separated by commas or new lines.
   Already-typed subjects appear as suggestion chips above the keyboard. Pasting a spreadsheet
   (tab-separated, days in a header row) fills all days at once. *Weeks differ (A/B)* duplicates the
   fields per rotation week.
5. **Review grid** — the parsed week as an editable grid (days × periods). Low-confidence cells are
   marked. Tap a cell to set subject, room, length (double lesson); tap a period to set its times;
   toggle days; add/remove periods; switch rotation weeks. If the draft has 2+ rotation weeks, the
   grid asks *This week is: A | B*. *Looks good* saves and lands on *Today*.
   The first timetable is valid from the Monday of the current week, open-ended. When another
   timetable already exists, the review grid also shows a *Starts* date row (pre-filled with the day
   after the current timetable ends, or next Monday) and saving trims the neighbour (R-2).

**AI parser (optional).** The parser is an interface (`TimetableParser`, R-13). The default and
only shipped implementation is on-device. A cloud implementation MAY be enabled at build time
(`VITE_PARSER_URL`); when enabled and online, the review grid offers *Try smart reading* if more
than 25 % of cells are low-confidence, behind a per-use consent sheet. It is **off by default**
(D-007).

### F-2 Subjects

- Created implicitly by onboarding, the review grid, the timetable editor and quick add
  (*New subject…* in the subject picker). Names are unique ignoring case and diacritics
  ("Französisch" = "franzosisch", "Mathe" ≠ "Math").
- Each subject has a pastel colour from the generator in `DESIGN.md §2.3` (a hue, or neutral).
  New subjects get the least-used preset; once all ten hued presets are taken, the hue farthest
  from every existing one.
- Optional short name (≤ 4 chars, used in the narrow week grid; derived when empty) and teacher.
- Edit: *Settings → Subjects* or long-press a lesson → *Edit subject*. Rename, recolour, delete.
  Delete removes the subject's lessons and unlinks its tasks (they keep title and due date);
  undoable.

### F-3 Timetables

- **Multiple timetables with date ranges.** Each has `validFrom` (inclusive) and `validTo`
  (inclusive, or open-ended). Ranges never overlap (R-2). Adding a timetable that starts inside
  another trims the other to end the day before, with an undo snackbar.
- **Periods** with start/end times; ≤ 14 per timetable; non-overlapping, ordered.
- **Lessons** on a weekday, in a rotation week, starting at a period, spanning 1–4 consecutive
  periods (double/triple lessons, E-6). A lesson MAY override its times (irregular lessons such as a
  shortened Friday, E-7).
- **Free periods** are simply empty slots (E-5). Importers map words like *Free/Frei/Слободен/—*
  to empty.
- **A/B week rotations** (1–4 week cycles). The cycle is anchored on a Monday; holiday-only weeks
  MAY be skipped so the alternation continues after a break (R-3). The Week tab can re-anchor with
  one action (*This is week B*) for schools that count by calendar-week parity (E-12).
- **School days**: any subset of Mon–Sun, at least one.

### F-4 Holidays

- Named date ranges (*Autumn break 26 Oct – 30 Oct*), single days allowed (*Teacher training*).
- On a holiday: no occurrences, no lesson-based reminders, *next lesson* searches skip it, the Week
  grid shows the day as a holiday, Today shows a holiday banner with the return date.
- Added in *Settings → Holidays* or imported from a school calendar `.ics` (F-12).
- Tasks due on a holiday are allowed (holiday homework). A task whose due date *becomes* a holiday
  keeps its date and shows a hint with *Move to next lesson* (E-2).

### F-5 Unified task model

One `Task` type with three kinds — **homework**, **assignment**, **test** — as a discriminated
union (§3). All kinds share: title, subject (optional), due, notes, steps (subtasks), attachments,
reminders, estimate, done state. Kind-specific: assignments and tests can have a study/work plan;
tests have topics and a result. Kind can change after creation: data the new kind doesn't support
(topics, plan, result) is dropped at that moment and the change shows an undo snackbar.

**Tests are never overdue.** Once a test's due moment has passed it was *written*: it leaves *Next up*
and reminders, and waits in the *Written* group of Tasks for a result (F-13) or a tick, for 14 days;
after that it counts as done. Homework and assignments become overdue (R-6).

Completing, un-completing, moving and deleting are optimistic and undoable (DESIGN §5).

### F-6 Natural-language quick add

A single text field that understands EN, MK and DE (R-12). As the student types, three token chips
under the field show what was understood — **kind**, **subject**, **due** — and are themselves the
controls to change it. Manual choices always win over parsing. Text that only expressed a date
("… on friday") is removed from the saved title; everything else is kept as typed.

### F-7 "Next lesson of subject" default due date

When a subject is known and no date was typed, the due date is the **next occurrence of that
subject** (R-5), shown as *Next lesson · Fri 9 Oct, 8:00*. When the subject has no upcoming lesson
within the search horizon, the due date falls back to tomorrow (end of day) and the due chip says
*No upcoming lesson*.

### F-8 Next up

*Today* shows the single most urgent item (task or study session) with one action (*Mark done*),
plus up to two *Then* items. Ranking is R-8. Tests and assignments also appear under *Coming up*
for 14 days.

### F-9 Study-plan generator

For a test or assignment in the future, *Plan my studying* (*Plan my work* for assignments)
generates study sessions (steps with a date and minutes) between today and the day before the due
date (R-11):

- Total minutes from the task estimate (defaults: test 120, assignment 240).
- Sessions are spaced towards the due date (expanding intervals), avoid days over the daily study
  cap, skip weekends unless allowed, and are titled from the test's topics.
- Preview before saving: a 3-week heatmap with the proposed days, session length (15/25/45/60) and
  count, *Add plan*. Each session is then a normal step: it appears in *Next up* on its day, can be
  ticked off, moved or deleted.
- *Re-plan* regenerates only unfinished planned sessions; finished ones and hand-made steps are kept.
- Missed sessions (date passed, not done) stay visible as *from Tue* until done, re-planned, or the
  task is due.

### F-10 Workload heatmap

Per-day load (R-10) shown as a 5-level neutral ramp:
- under each day header in **Week** (one row = one week of heat),
- at the bottom of each day cell in the **date picker** month grid (which also marks days with a
  test due),
- in the **study-plan preview** (3 weeks).

The level is drawn as a *heat bar* whose length and darkness both grow with load (DESIGN §2.4).

Each heat cell has a text alternative ("Wednesday: busy — about 80 minutes, 3 things").

### F-11 Local notifications

- Native (Capacitor iOS/Android) via the Local Notifications plugin. The **web/PWA build has no
  background reminders** (D-011): *Settings → Reminders* explains this and offers installing the app.
- Permission is requested **in context**, never at onboarding: after the first test or assignment is
  added (native build, reminders off), the snackbar offers *Remind me the day before* — once. Every
  other time a test or assignment is added, the snackbar offers *Plan studying* (*Plan work* for
  assignments) instead.
- Rules (R-14): *before due* per kind (defaults: homework 1 day before 18:00; test 3 days and 1 day
  before 18:00; assignment 2 days before 18:00), *study session* on the planned day at the preferred
  study time, optional evening *digest* ("Tomorrow: 6 lessons, 2 things due"). Per-task overrides.
- Tapping a notification opens the task. Homework reminders carry a *Done* action.
- Nothing fires for done tasks or written tests. The evening digest is skipped when tomorrow has no
  lessons and nothing due (weekends, holidays).

### F-12 Export and import

- **Backup (JSON):** *Settings → Back up* writes `term-backup-yyyy-mm-dd.json` (all data, attachments
  base64-inlined) via the share sheet or a download. Import via *Settings → Import* or onboarding
  *Method*: validates, shows a summary ("3 timetables, 9 subjects, 41 tasks"), replaces all data,
  undoable. Accepts backup versions 1 and 2.
- **Calendar export (.ics):** *Settings → Export to calendar* writes lessons (recurring, R-15),
  tests and assignments (at their due moment) and holidays (all-day). Homework is not exported.
  Covers the next 26 weeks or until the timetable ends, whichever is first.
- **Calendar import (.ics):** all-day events become holiday candidates (checklist to confirm);
  weekly recurring timed events become a draft timetable in the review grid.

### F-13 Test results

After a test's due moment (*written*, F-5), its detail shows a result form: grade as written (free
text: "5", "1−", "B+", "13 P"), optional score / out of, note. Saving marks the test done. Ticking a
written test without a result is fine. Results are shown on the test and in the subject's list of
past tests. No averages (non-goal).

### F-14 Steps and attachments

- **Steps (subtasks):** a checklist inside any task. Row shows progress ("2/5"). Planned steps
  (F-9) carry a date and minutes.
- **Attachments:** photos (camera or library), PDFs, other files ≤ 10 MB each. Images are
  downscaled to ≤ 2048 px (JPEG q 0.85, EXIF stripped) on add. Stored as Blobs in IndexedDB,
  thumbnails generated once. Tap to view full screen; long-press to share or delete.

### F-15 Personalisation and settings

Theme (System/Light/Dark), accent (8), language (EN/MK/DE), timetables, subjects, holidays,
reminders, study preferences (daily cap, session length, preferred time, weekends), backup,
calendar export, import, erase everything, and *About* (version, privacy statement, accessibility
statement with keyboard shortcuts, open-source licences).

### F-16 Languages

EN, MK, DE everywhere: UI, quick-add grammar, OCR, importer keywords, dates, plurals, notifications,
`.ics` summaries. Language follows the device on first run and can be changed on *Welcome* and in
*Settings*.

---

## 3. Data model

All persisted types live in `src/domain/types.ts`. Stored in Dexie (IndexedDB), schema in §3.3.
Every stored entity has a string `id` (ULID-style, sortable), `createdAt` and `updatedAt`
(epoch ms, for ordering and backups only — never for scheduling).

### 3.1 Types

```ts
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
export type ThemePref = 'system' | 'light' | 'dark';
export type Language = 'en' | 'mk' | 'de';

interface Stored {
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

/** Generator parameters, kept so "Re-plan" reproduces the student's choices. */
export interface StudyPlan {
  generatedAt: Millis;
  sessionMinutes: 15 | 25 | 45 | 60;
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
  study: {
    maxMinutesPerDay: number; // 30–240, default 90
    sessionMinutes: 15 | 25 | 45 | 60; // default 25
    preferredTime: HHmm; // default 17:00
    weekends: boolean; // default true
  };
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
```

### 3.2 Constants

| Name | Value | Used by |
| --- | --- | --- |
| `LEAD_DAYS` | homework 0, test 2, assignment 3 | R-8 |
| `KIND_WEIGHT` | test 0, assignment 1, homework 2 (lower = more important) | R-8, R-9 |
| `DEFAULT_ESTIMATE_MIN` | homework 30, test 120, assignment 240 | R-10, R-11 |
| `END_OF_DAY` | 23:59 | R-6 |
| `NIGHT_OWL_UNTIL` | 04:00 | R-12 |
| `NEXT_LESSON_HORIZON_DAYS` | 120 | R-5 |
| `COMING_UP_DAYS` | 14 | F-8 |
| `MAX_PERIODS` / `MAX_SPAN` / `MAX_ROTATION` | 14 / 4 / 4 | F-3 |
| `MAX_ATTACHMENT_BYTES` | 10 485 760 | F-14 |
| `NOTIFICATION_BUDGET` | 60 pending (iOS cap is 64) | R-14 |
| `SNACKBAR_MS` | 6000, paused while hovered/focused/pressed | DESIGN §5 |

### 3.3 Storage

Dexie database `term`, schema version 2:

```ts
this.version(2).stores({
  subjects: 'id, name',
  timetables: 'id, validFrom',
  holidays: 'id, start, end',
  tasks: 'id, due.date, subjectId, doneAt, kind',
  attachments: 'id, taskId',
  settings: 'id', // single row 'main'
}).upgrade(migrateV1toV2); // §9.2
```

Writes that touch more than one table run in one transaction. The UI never waits for a write
before updating (optimistic, DESIGN §5.4); a failed write reverts and shows an error snackbar.

### 3.4 Invariants (validated on save, on import and in tests)

1. Timetable ranges don't overlap; `validTo ≥ validFrom`.
2. Periods are ordered, non-overlapping, `end > start`, ≤ 14.
3. In one timetable, for each `(week, day)`, lesson period ranges `[periodIndex, periodIndex+span)`
   don't overlap and stay within the period list. One lesson per slot (E-15).
4. `lesson.week < rotation.weeks`; `rotation.anchor` is a Monday; `0 ≤ anchorIndex < weeks`.
5. `lesson.time`, when set, has `end > start`.
6. Every `lesson.subjectId` and non-null `task.subjectId` exists.
7. `task.attachmentIds` and `attachment.taskId` agree; deleting a task deletes its attachments
   (inside the undo window they are kept in memory).
8. `result` is only set on tests; `plan` only on tests and assignments.
9. Subject names unique by `fold()`.

---

## 4. Rules

All date logic uses `date-fns` calendar functions on local dates. **Never** add or subtract
`86 400 000 ms`; never compare dates by milliseconds when calendar days are meant.

**R-1 Time model.** Dates are `DateKey`s and times are `HHmm` in the device's current time zone
("floating"). An instant is built with `atTime(date, hhmm)` = local midnight of `date` plus wall-clock
hours/minutes. When a wall-clock time does not exist (DST spring-forward) the instant moves forward to
the next valid minute; when it exists twice (fall-back) the first one is used (E-10). "Today" is the
device's local date; the UI re-evaluates every minute and on resume.

**R-2 Timetable for a date.** `timetableFor(date)` = the timetable with
`validFrom ≤ date ≤ (validTo ?? ∞)`. At most one by invariant 1. None → no lessons that day.
Creating or editing a range that overlaps another trims the other one (it ends the day before the
new one starts, or starts the day after the new one ends); if that would leave it with no days, it
is replaced. Either way an undo snackbar names the change ("Autumn term now ends 31 Jan · Undo").

**R-3 Rotation index.** For a date `d` in timetable `t`:
```
monday  = startOfISOWeek(d)
weeks   = differenceInCalendarWeeks(monday, t.rotation.anchor, { weekStartsOn: 1 })   // signed
skipped = t.rotation.skipHolidayWeeks
            ? number of Mondays m strictly between anchor and monday (in the direction of travel)
              whose week has no school day because every day in t.days is a holiday
            : 0
index   = mod(t.rotation.anchorIndex + sign(weeks) * (|weeks| − skipped), t.rotation.weeks)   // mod ≥ 0
```
A week that is itself all holiday has no occurrences, so its index is irrelevant. *This is week X*
sets `anchor = monday(current week)`, `anchorIndex = X`.

**R-4 Occurrences on a date.** `occurrencesOn(date)`:
1. No timetable (R-2), or the date is in a holiday, or its weekday ∉ `t.days` → `[]`.
2. Take lessons with `day = weekday(date)` and `week = rotationIndex(date)`.
3. For each: `start = lesson.time?.start ?? periods[i].start`,
   `end = lesson.time?.end ?? periods[i + span − 1].end`, as instants via R-1.
4. Sort by start.

Editing a lesson's room, span, time, day or period keeps its `id`; changing its subject removes the
lesson and creates a new one (tasks linked to the old id fall back per R-6).

**R-5 Next lesson of a subject.** `nextLessonOf(subjectId, now)`:
1. Walk dates from `today` up to `NEXT_LESSON_HORIZON_DAYS` ahead, stopping early after the last
   timetable's `validTo`.
2. Candidates are occurrences of the subject with `start > now`.
3. **Same-day rule:** if an occurrence of the subject has already *started* today, skip all of today's
   remaining occurrences (homework given in period 2 is not due in period 6 the same day). Before
   the first one starts (e.g. 06:30), today's lesson is a valid candidate.
4. A multi-period lesson is one occurrence; due at its start.
5. None found → `null` (F-7 fallback).

**R-6 Due moment.** For `task.due`:
1. `lessonId` set and the lesson has an occurrence on `due.date` → that occurrence's start.
2. Else `time` set → `atTime(date, time)`.
3. Else `atTime(date, END_OF_DAY)`.
When a due is set from a lesson, `time` is filled with that occurrence's start (snapshot). An
explicitly typed or picked time sets `time` and clears `lessonId` (the student's time wins).
**Overdue** = homework or assignment, not done, due moment < now. **Written** = test, not done,
due moment < now (never overdue, F-5).

**R-7 Lesson ↔ task attachment.** A task belongs to an occurrence when `due.date` equals the
occurrence date and either `due.lessonId` is that lesson, or `due.lessonId` is null/unresolved, the
task's subject matches, and the occurrence is: (with `time`) the one containing that time, else the
last one starting before it, else the first; (without `time`) the subject's first occurrence that day. (Used for dots in
Week, rows in Today and the lesson sheet.)

**R-8 Next-up ranking.** Items are open tasks except written tests, plus *session items*:
unfinished planned steps of open tasks with `plannedFor ≤ today` and parent due moment > now.
```
for a task:      effective = overdue ? due : due − LEAD_DAYS[kind] days
for a session:   effective = atTime(max(plannedFor, today), study.preferredTime), due = parent's due
sort by: overdue first → effective ↑ → due ↑ → KIND_WEIGHT ↑ (sessions use the parent's kind)
         → createdAt ↑
```
*Next up* = first item; *Then* = next two. Tasks whose effective date is in the future still rank
(the list is never empty while anything is open). Sessions rank at the student's study time, so
homework due in a lesson later today comes before this afternoon's study session, and a missed
session comes back today rather than jumping the queue.

**R-9 Task buckets (Tasks tab).** Overdue · Today · Tomorrow · This week (2–6 days) · Later ·
Written (tests awaiting a result, ≤ 14 days old) · Done. Calendar-day differences from today; empty
groups are omitted. Within a bucket: due moment ↑, then `KIND_WEIGHT`, then
`createdAt`. *Done* shows tasks completed in the last 30 days, newest first; older done tasks stay
in the database and in backups.

**R-10 Load per day.** For each open task, minutes `m = estimateMin ?? DEFAULT_ESTIMATE_MIN[kind]`
are allocated to dates ≥ today:
- planned steps: their `minutes` on `plannedFor` (missed ones count on today); the remainder
  `m − Σ planned` (if > 0) is spread like an unplanned task;
- homework: all on the last day before the due date (today if that is in the past);
- unplanned test/assignment: spread evenly over the `LEAD_DAYS[kind] + 1` days before the due
  date (only days ≥ today; at least today).
Done tasks and steps count 0. `level = 0` for 0 min, else
`min(4, 1 + floor(3 × minutes / study.maxMinutesPerDay))` → levels 1–3 below the cap, 4 at or above it.
The date picker additionally marks days with a test due (independent of level); Week shows tests
inside their lesson cells instead.

**R-11 Study-plan generation.** Deterministic, pure (`plan(task, now, load, settings) → Subtask[]`):
1. `due` = due date; window = dates from `max(today, due − 14)` to `due − 1`, minus weekends when
   `!study.weekends`. Holidays are allowed (that's when students have time).
2. `n = clamp(ceil(m / sessionMinutes), 1, |window|)`, or the student's chosen count.
3. Target offsets from `due`, expanding: 1, 2, 4, 7, 11, 14 days, then the remaining window days
   nearest to `due`. For each target pick it, or — if the target's load (including sessions already
   picked) would exceed `maxMinutesPerDay` — its least-loaded neighbour within ±1 day that is free.
   Fall back to the target if no neighbour fits.
4. Titles: with topics, round-robin one topic per session ("Study: Mitosis"); without, "Study 1/n";
   the last session is always "Full review" (assignments: "Work on {title} 1/n", last "Finish & check").
5. Window empty (due today/tomorrow morning) → one session today, titled "Quick review".
6. *Re-plan* removes unfinished `origin: 'plan'` steps and repeats with the stored `StudyPlan`.

**R-12 Quick-add grammar.** Tokenised, case- and diacritic-folded. Recognised (EN · MK · DE):

| Slot | Examples |
| --- | --- |
| Kind: test | test, exam, quiz, midterm, finals · тест, контролна, писмена, испит · Test, Klausur, Prüfung, Klassenarbeit, Schulaufgabe, compounds *-test, -arbeit, -klausur*. Not "ex" (= exercise in EN) and not "final" ("final draft"). |
| Kind: assignment | essay, project, report, presentation · есеј, проект, семинарска, реферат, презентација · Aufsatz, Projekt, Referat, Präsentation, Hausarbeit, Facharbeit |
| Kind: homework | homework, hw, worksheet · домашна, домашно · Hausaufgabe(n), Übung, Arbeitsblatt |
| Subject | full name, abbreviation, prefix ≥ 3 letters ("bio"), German compounds ("Mathetest") |
| Relative day | today, tonight, tomorrow/tmrw, day after tomorrow · денес, утре, задутре · heute, morgen, übermorgen |
| Weekday | monday/mon … · понеделник/пон … · Montag … (next occurrence, never today) |
| Next week | next week · следната недела · nächste Woche → that week's first lesson of the subject, else Monday |
| In N days | in 3 days · за 3 дена · in 3 Tagen |
| Numeric date | 12.10, 12/10, 12.10.2026 — day-first in all three languages; without a year only within 120 days |
| Time | at 10, 10:30, 10h · во 10 · um 10 (Uhr) → `due.time`; `lessonId` cleared (R-6) |

Rules: the first match per slot wins; ambiguous subject matches pick the longest match; nothing is
guessed below confidence (no fuzzy spelling). **Night owl:** between 00:00 and `NIGHT_OWL_UNTIL`,
"tomorrow" means today's date and weekday words count from today (it's still "last night").
A typed date with a subject attaches to that subject's lesson on that date if there is one.

**R-13 Import pipeline.** `File → (pdf.js text layer | OCR) → WordBox[] → layout parser → text
parser fallback → DraftTimetable → validate → review`. PDFs with < 6 text words are rasterised and
OCR'd. OCR language data for `eng`, `deu`, `mkd` (tessdata *fast*) ships with the app and is cached
on first use from the app's own origin — no third-party requests (N-6). Layout parser: cluster words
into rows/columns, detect weekday headers (EN/MK/DE, abbreviations), time ranges, period numbers,
A/B headings ("Week A", "Woche B", "Недела А"), merge vertically adjacent identical subject cells
into a span. Confidence per cell = OCR word confidence × structural fit. `TimetableParser`:
```ts
interface TimetableParser {
  id: 'local' | 'cloud';
  parse(file: File, language: Language, onProgress: (phase: ImportPhase, fraction: number) => void,
        signal: AbortSignal): Promise<DraftTimetable>;
}
```
The optional cloud parser posts a downscaled (≤ 1600 px), EXIF-stripped JPEG to
`VITE_PARSER_URL/v1/timetable` and validates the JSON response with the same validator; 20 s timeout;
the server MUST NOT retain images.

**R-14 Reminder scheduling.** Pure function `schedule(now, data) → Notification[]`, then diffed
against pending OS notifications. Steps: expand every enabled rule for open tasks over the next
30 days → drop instants ≤ now, drop instants ≥ the task's due moment → merge instants within the
same minute into one ("2 things due tomorrow") → digest only when tomorrow has lessons or something
due → sort → keep the first `NOTIFICATION_BUDGET`. Re-run (debounced 2 s) on any data change, on
app start and resume, at local midnight, and when the zone differs from
`notifications.scheduledInZone`. Notification ids are stable hashes of `(rule, task, instant)` so
re-runs are idempotent.

**R-15 Calendar export.** One `VEVENT` per lesson and timetable segment with
`RRULE:FREQ=WEEKLY;INTERVAL=<rotation.weeks>;UNTIL=<end>` and `EXDATE`s for holiday dates; when
`skipHolidayWeeks` shifts the cycle, the series is split into segments at each skipped week. Times
are floating local (`DTSTART:20261009T080000`, no `TZID`, no `Z`) to match R-1. `UID`s are
`<entity id>@term` so re-exports update rather than duplicate. Holidays are all-day `VEVENT`s; tests
and assignments are `VEVENT`s at their due moment (lesson length, or all-day when due end-of-day).
Lines folded at 75 octets, CRLF, text escaped per RFC 5545.

---

## 5. Information architecture

```
App
├─ Setup flow (full screen, no tab bar)      Welcome → Method → Importing | Manual builder → Review
├─ Tab: Today      (default)                 FAB +
├─ Tab: Week                                 FAB +
├─ Tab: Tasks                                FAB +
└─ Tab: Settings                             no FAB
     ├─ Timetables → Timetable editor (grid) → Cell sheet / Period sheet
     ├─ Subjects → Subject sheet
     ├─ Holidays → Holiday sheet
     ├─ Reminders
     └─ Study
Sheets (over any tab): Quick add · Task detail · Test detail · Lesson sheet · Date picker ·
                       Study-plan preview · Reminder override · Attachment viewer ·
                       Restore summary · Holiday checklist (.ics) · Smart-reading consent (flag)
Menus (long-press):    task row · lesson · step · attachment · FAB (kind) · rotation label
```

Navigation is a tab plus a stack of pushed screens, mirrored into browser history (Android back,
browser back and iOS swipe-back all work). Sheets are history entries too. Re-tapping the active
tab pops to the tab root; at the root it scrolls to top. Pushed screens exist only in the Settings
stack and keep the tab bar visible. On ≥ 900 px the tab bar becomes a left rail.

### 5.1 Today

What it answers: *what now, what next, what's coming?*

1. Header: date (eyebrow, plus *Week B* when rotating) and title *Today*.
2. **Holiday banner** when today is a holiday: "Autumn break — back Mon 2 Nov".
3. **Next up** card (F-8): one item with *Mark done*; up to two *Then* rows; *All clear* empty state.
4. **Lessons**: today's occurrences as a timeline — time, subject colour bar, subject, room, tasks
   due in that lesson, *Now* highlight with progress, free-period rows between lessons, double
   lessons as one row. After the last lesson (or on a non-school day) it shows the **next school
   day** with a one-line explanation ("Done for today" / "No school today").
5. **Coming up**: tests and assignments in the next 14 days, excluding today (max 6; a *Show all*
   row opens Tasks when there are more).
6. Empty/edge states: no timetable (card to add one), timetable ended (card to add the next),
   school not started yet ("School starts Tue 1 Sep").

Primary action: **FAB +** (quick add).

### 5.2 Week

What it answers: *what does my week look like, and how busy is it?*

1. Header: date range (eyebrow) and *Week*; rotation label (*Week A*) as a button when rotating
   (→ *This is week B*).
2. Week navigation: previous/next, *Today* when not on the current week; horizontal swipe changes
   weeks.
3. **Load row** (F-10) under the day headers.
4. **Grid**: day columns × period rows; subject pastel per lesson; double lessons span rows; holiday
   days drawn as one hatched column with the holiday name; today's column header highlighted; the
   current lesson ringed; task markers per lesson (hollow = homework/assignment, filled = test).
5. Tap a lesson → lesson sheet (tasks due then, *Add for this lesson*). Long-press → context menu
   (*Add homework*, *Add test*, *Edit lesson*, *Edit subject*).
6. Weeks outside any timetable show the empty state with *Add timetable*.

Primary action: **FAB +** (long-press the FAB to start Quick add as homework, assignment or test).

### 5.3 Tasks

What it answers: *everything I have to do, in order.*

1. Header *Tasks* with the count of open items.
2. Groups (R-9): Overdue, Today, Tomorrow, This week, Later, Written; **Done** collapsed at the
   bottom.
3. Row: checkbox (shape by kind), title, subject dot + name, due text, steps progress, attachment
   glyph. Tap → detail. Swipe right → complete; swipe left → *Next lesson* / *Delete*; long-press →
   context menu.
4. Empty state: "Nothing to do. Add homework with +".

Primary action: **FAB +**.

### 5.4 Settings

What it answers: *make it mine, keep my data safe.*

Sections: **Appearance** (theme, accent), **Language**, **School** (timetables, subjects, holidays),
**Planning** (reminders, study), **Data** (back up, export to calendar, import, erase everything),
footer row (version, "Everything stays on this device") → *About*. On web/iOS Safari outside an installed PWA a
one-line *Install TERM* row appears at the top (E-18).

No primary accent action: Settings is a list; each row is one tap.

### 5.5 Tap budget (max 3 taps, counted from anywhere, including the tab switch)

| Action | Path | Taps |
| --- | --- | --- |
| Add homework (subject+date typed) | `+` → type → *Add* | 2 |
| Add homework for a specific lesson | Week → lesson → *Add for this lesson* → type → *Add* | 3 |
| Complete the next thing | Today → *Mark done* | 1 |
| Complete any task | Tasks → checkbox / swipe | 2 |
| Move a task to the next lesson | Tasks → swipe left → *Next lesson* | 3 |
| Plan studying for a new test | snackbar *Plan studying* → *Add plan* | 2 |
| Plan studying for an existing test | Tasks → long-press test → *Plan studying* (default plan, undoable) | 3 |
| … with a preview to adjust it | Tasks → test → *Plan my studying* → *Add plan* | 4 (optional path) |
| Add a test result | Tasks → written test → type grade → *Save result* | 3 (+ typing) |
| Add a test directly | long-press FAB → *Test* → type → *Add* | 3 |
| Edit a lesson | Week → long-press lesson → *Edit lesson* | 3 |
| Add a holiday | Settings → Holidays → *Add* | 3 |
| Change accent | Settings → swatch | 2 |
| Back up | Settings → *Back up* | 2 |
| Export to calendar | Settings → *Export to calendar* | 2 |
| Switch A/B | Week → *Week A* → *This is week B* | 3 |

---

## 6. Edge cases

| ID | Case | Behaviour |
| --- | --- | --- |
| E-1 | **Holiday on a lesson day** | No occurrences; Week shows a hatched holiday column; next-lesson search skips it; lesson reminders and digests don't fire. |
| E-2 | **Task due on a (new) holiday** | Keeps its date; detail shows "During Autumn break" with *Move to next lesson*. Not moved silently. |
| E-3 | **Whole week is holiday** | Week grid is replaced by a holiday empty state ("Autumn break · back Mon 2 Nov"); load row still shows (holiday homework). |
| E-4 | **Holiday longer than the search horizon / summer** | Next-lesson search stops at the last timetable's end; F-7 fallback. |
| E-5 | **Free periods** | Empty slots. Today shows a *Free · 45 min* row only *between* lessons; leading/trailing free periods produce no row. Week shows an empty cell (no label, `aria-label` "Free"). |
| E-6 | **Lessons spanning periods** (double/triple) | One lesson with `span`; one cell spanning rows in Week, one row in Today with the full time range, one occurrence for due dates. The break between the periods belongs to the lesson. Importer merges vertically adjacent identical cells; review can split (span − 1). |
| E-7 | **Irregular times** (short Friday, sports 14:00–16:30) | `lesson.time` override; grid keeps the lesson in its period row with its own time label; overlaps with neighbours are rejected on save. |
| E-8 | **A/B weeks** | `rotation.weeks = 2`; editor and review switch weeks with a segmented control; *Same in both weeks* toggle on a cell copies it. Week tab labels the week. |
| E-9 | **A/B across holidays** | `skipHolidayWeeks` (default **true** for 2+ week cycles): a holiday-only week doesn't advance the cycle. Partial holiday weeks advance normally. |
| E-10 | **DST** | All scheduling via R-1 wall-clock construction. Week navigation by calendar weeks; countdowns from instants. A reminder set at a non-existent time fires at the next valid minute. Lessons never straddle a transition (02:00–03:00). Unit tests run in `Europe/Skopje`, `Europe/Berlin`, `America/New_York` and `Australia/Lord_Howe` (30-min DST). |
| E-11 | **Time-zone change** (school trip) | Times are floating: lessons stay at the same wall-clock time. On resume, if the zone differs from `scheduledInZone`, notifications are rescheduled. |
| E-12 | **ISO week 53 / parity schools** | Rotation counts continuous calendar weeks, so it never "skips" at New Year; schools that use odd/even ISO week numbers flip after a 53-week year (2026 has one). *This is week B* re-anchors in one action. |
| E-13 | **Mid-week timetable change** | `validFrom`/`validTo` can be any day; a week may mix two timetables (Mon–Wed old, Thu–Fri new). Each day column renders its own timetable's lessons; row headers (period numbers and times) come from the timetable covering the most days of that week, and cells whose times differ from their row show their own time. The rotation label is that same timetable's. |
| E-14 | **Gap between timetables / ended timetable** | Days in no timetable have no lessons; Today and Week show "No timetable for these dates" with *Add timetable* (next one pre-fills `validFrom`). |
| E-15 | **Two subjects in one slot** (split groups, "Rel/Eth") | Not modelled: one lesson per slot. Review shows the raw text; the student picks their subject. Alternating subjects → A/B. |
| E-16 | **Now is inside a lesson of the subject being added** | R-5 same-day rule: due next lesson on a later day. |
| E-17 | **Midnight / night owl** | Today switches at 00:00; quick-add relative words use the night-owl rule (R-12). |
| E-18 | **iOS Safari storage eviction** | Non-installed sites may lose IndexedDB after 7 days without use. Request `navigator.storage.persist()`; show *Install TERM* in Settings and a one-time card on Today after onboarding when not standalone; *Back up* subtitle shows the last backup date and turns to a nudge after 30 days. |
| E-19 | **Storage full / write fails** | Optimistic change reverts; error snackbar "Couldn't save — your device storage is full". Attachments refuse files that would exceed the quota estimate. |
| E-20 | **Subject deleted** | Its lessons are removed, its tasks keep title/date and lose the subject; one undo restores all. |
| E-21 | **Period deleted** | Lessons starting there are removed, lessons spanning it shrink; tasks fall back to their `time` snapshot. Undoable. |
| E-22 | **Lesson's subject changed** | New lesson id (R-4); existing tasks keep their due moment via the snapshot. |
| E-23 | **No upcoming lesson of a subject** | F-7 fallback (tomorrow, end of day) with *No upcoming lesson*. |
| E-24 | **Due date in the past** | Quick add never produces one: a past day-month without a year means next year if within 120 days, otherwise it isn't read as a date ("ex 4.7" stays text). A past date *can* be picked in the date picker (logging late work); the task is then immediately overdue and its due chip shows the date in `danger`. |
| E-25 | **Weekend / no school today** | Today lists the next school day's lessons under "No school today". |
| E-26 | **School hasn't started** (first `validFrom` in the future) | Today: "School starts Tue 1 Sep" + that day's lessons. |
| E-27 | **Very many subjects (> 12)** | Hues assigned farthest-first; neighbours may look similar, so the subject name is always visible next to its colour. |
| E-28 | **Long names** (DE compounds, MK) | Lists truncate with ellipsis; Week uses `short` or a derived abbreviation; full name in `aria-label` and lesson sheet; `hyphens: auto` with `lang` set. |
| E-29 | **Seven school days on a 375 px phone** | Columns would be < 44 px; the grid scrolls horizontally with 48 px minimum columns and snaps to days, today scrolled into view. |
| E-30 | **Empty title** | Allowed when a subject is set; label becomes "Math homework" / "Biology test". Neither title nor subject → *Add* disabled. |
| E-31 | **Duplicate quick add** (double-tap *Add*) | The button disables on first press; a second identical task within 2 s is ignored. |
| E-32 | **Backup from a newer app version** | Rejected with "This backup is from a newer TERM — update the app first". Unknown fields in same-version backups are dropped, never crash. |
| E-33 | **Import while data exists** | Restore replaces everything after a confirmation that names what will be replaced; undo snackbar holds the previous snapshot. Calendar import only adds. |
| E-34 | **Clock set wrong / time jumps** | Everything derives from `now` on each tick; no stored "last seen day" logic; notifications rescheduled on resume. |
| E-35 | **Reduced motion, large text (200 %), screen reader, keyboard-only** | See N-3 and DESIGN §7. |
| E-36 | **Test with no subject and no date typed** | Kind detected, subject null → due defaults to tomorrow, end of day. Nothing blocks *Add*; the due chip reads "Tomorrow" so the guess is visible and one tap away from changing. |
| E-37 | **Leap day / month ends** | Recurrences are weekly, so Feb 29 needs no handling beyond date-fns; numeric date "29.02" in a non-leap year is rejected as a date. |
| E-38 | **Test date passes without a tick** | It is *written*, not overdue (F-5): no danger colour, no reminders, no study sessions; it waits in *Written* for 14 days. |
| E-39 | **Test or assignment moved after planning** | Planned sessions keep their dates; sessions now on or after the new due date are flagged "after the test" and *Re-plan* is offered in the snackbar ("Moved to Tue 13 · Re-plan"). |
| E-40 | **Plan window too short** (due tomorrow) | One "Quick review" session today (R-11.5); the preview says so instead of showing a calendar. |
| E-41 | **Subject without lessons** (e.g. added in quick add) | Allowed; next-lesson fallback applies; it appears in subject pickers and Settings → Subjects with "No lessons". |
| E-42 | **Rotation reduced** (A/B → every week) | The editor asks which week to keep (one choice sheet, not a confirm); lessons of other weeks are removed, undoable. |
| E-43 | **Notifications denied / revoked in system settings** | `notifications.enabled` is reconciled on resume; Reminders shows "Allow notifications for TERM in Settings" with a button that opens the system settings page. |
| E-44 | **Pending notification for a deleted or completed task** | Cancelled on the next schedule run (R-14 runs on every data change); undo reschedules. |

---

## 7. Non-functional requirements

**N-1 Performance.**
- **Cold start < 1 s**: from navigation start (PWA, warm HTTP cache) or WebView `DOMContentLoaded`
  (native) to *Today* rendered with real data, p75 on a mid-range phone (Pixel 6a / iPhone 11 class;
  in CI: Lighthouse mobile preset, 4× CPU throttle) with 1 000 tasks, 3 timetables, 20 subjects.
- First paint uses the theme from `localStorage` (no flash), no web fonts, no layout shift
  (CLS < 0.02).
- Initial JS ≤ 150 KB gzip; pdf.js, Tesseract, the importer, `.ics`, the date picker and settings
  sub-screens are lazy chunks.
- Queries: open tasks by index; done tasks limited to 30 days; occurrence computation memoised per
  date. Interaction to next paint ≤ 100 ms; animations at 60 fps with transforms/opacity only.

**N-2 Offline-first.** Every feature works offline except the optional cloud parser. The app shell,
OCR engine and OCR language data are served from the app's origin and cached by the service worker.
No feature waits on the network; updates apply on next launch (`autoUpdate`) and never interrupt an
open sheet.

**N-3 Accessibility — WCAG 2.2 AA**, with these specifics:
- Contrast: text ≥ 4.5:1, large text and UI graphics ≥ 3:1, in both themes, every accent, every
  subject hue (asserted in unit tests, DESIGN §2.2).
- Target size ≥ 44 × 44 px for every interactive element (exceeds 2.5.8).
- 2.5.7 Dragging / 2.5.1 Pointer gestures: every swipe, drag and long-press has a single-tap
  alternative (checkbox, detail sheet buttons, context menu via the row's keyboard menu key or
  right-click).
- 2.4.11 Focus not obscured: sticky bars, FAB and snackbar never cover the focused element
  (scroll-padding equals their height).
- 2.2.1 Timing: the undo snackbar pauses while hovered, focused or pressed; every undo is also
  available via ⌘/Ctrl-Z while the app is open (last 10 actions).
- Screen readers: landmarks, headings per section, grid semantics in Week and review, live region
  for completions/imports, every icon button labelled. Text resizes to 200 % without loss
  (content reflows, no fixed heights on text containers).
- Reduced motion: no transforms or parallax, no looping animation; state changes still visible.

**N-4 Internationalisation.** EN, MK, DE with identical key sets (tested). ICU plurals via i18next
(`_one`, `_few`, `_other` as each language needs). Dates via `date-fns` locales; first day of week
Monday in all three; times in 24 h for MK/DE and per device preference for EN (`Intl` hour cycle).
`lang` attribute follows the language (hyphenation, screen-reader voice). No string concatenation
for sentences; no text in images.

**N-5 Reliability and data.** Data durability is the product: `navigator.storage.persist()` after
onboarding, transactions for multi-table writes, schema migrations tested with fixture databases
from every past version, backups round-trip losslessly (tested), import validates everything.
Backups are assembled from `Blob` parts (attachments streamed in) so a large backup never needs
one giant in-memory string.

**N-6 Privacy and security.** No accounts, analytics, trackers or third-party requests. A strict CSP:
`default-src 'self'; script-src 'self' 'wasm-unsafe-eval' 'sha256-<boot script>'; img-src 'self'
blob: data:; worker-src 'self' blob:; connect-src 'self'` (+ the parser origin only when the flag is
set). `wasm-unsafe-eval` is required by the OCR engine; the inline theme-boot script in
`index.html` is allowed by hash, not by `unsafe-inline`. No `eval`; user text rendered as text; URLs in
notes are linkified with `rel="noopener noreferrer"`. Suitable for under-13s (COPPA) and under-16s
(GDPR-K) because no personal data leaves the device.

**N-7 Platforms.** iOS 16.4+ (Capacitor WKWebView and Safari PWA), Android 9+ (Capacitor, Chrome
110+), desktop evergreen browsers. Phone portrait first; landscape and tablet supported (no
orientation lock — the manifest uses `any`); ≥ 640 px sheets become dialogs; ≥ 900 px tab bar
becomes a rail. Known limitation: iOS Dynamic Type is not applied inside the native WebView
(browser zoom and Android font scale are).

**N-8 Quality gates.** `npm run typecheck`, `lint` (zero warnings), `test` (Vitest), `build`, `e2e`
(Playwright, mobile viewport, light + dark, axe) pass on every change. Domain rules R-1…R-15 have unit
tests including every edge case marked as testable above.

---

## 8. Acceptance checks ("done when" for 2.0)

1. Quality gates (N-8) all pass.
2. E2E: typed onboarding (5 days) completes in ≤ 10 interactions and *Today* shows lessons.
3. E2E: a PDF and a screenshot timetable import into the review grid with ≥ 90 % of cells correct
   (fixtures in `e2e/fixtures`), double lessons merged.
4. E2E: an A/B timetable shows different lessons in consecutive weeks; *This is week B* flips them.
5. E2E: a holiday removes lessons from Week and Today and moves "next lesson" past it.
6. E2E: quick add "Math test friday" creates a Math **test** due Friday at the Math lesson; it appears
   in *Next up* once within lead time; "домашна по англиски утре" and "Deutsch Aufsatz 12.10" parse.
7. E2E: completing a task shows undo; undo restores it; swipe and checkbox both complete.
8. E2E: *Plan my studying* creates sessions on days under the cap; ticking one updates load.
9. E2E: backup export → erase → import restores everything (including an attachment); `.ics` export
   validates against an RFC 5545 parser.
10. E2E: axe reports no serious/critical violations on every screen, light and dark.
11. E2E: theme, accent, language persist across reloads; the app works offline after first load,
    including OCR.
12. Unit: R-1…R-15 incl. DST zones (E-10), rotation (E-9, E-12), next-lesson (E-16, E-4), load,
    plan determinism; contrast of all token pairs, accents and 360 subject hues; locale key parity.
13. Perf: Lighthouse mobile cold start of *Today* < 1 s with the 1 000-task fixture.

---

## 9. Delta from v1 and migration

### 9.1 What changes in the code

| Area | v1 (current code) | 2.0 (this spec) |
| --- | --- | --- |
| Tabs | 3 (Today, Week, Tasks) + gear → Settings screen | 4 tabs incl. Settings; gear removed |
| Timetable | one (`id: 'main'`), `bells[]`, lessons by period index | many with date ranges, `periods[]` with ids, rotation, spans, time overrides |
| Holidays | none | `holidays` table, F-4 |
| Subject colour | 11 named pastels (`color: 'sky'`) | generated from `hue` (DESIGN §2.3); presets map 1:1 |
| Task | flat, `due` + `period` index, `notes` | discriminated union, `Due`, steps, attachments, reminders, estimate, plan, result |
| Task editing | one sheet (form + Save) | Quick add sheet (create) + detail sheet (live-edit, no Save) |
| Next lesson | 14-day search, strictly after now | 120-day horizon, same-day rule, holidays, rotation |
| Toast | `Toast`, 5 s | renamed `Snackbar`, 6 s, pause on hover/focus/press, ⌘Z history, FAB lifts above it |
| Accent swatches | 8 in one row (≈ 35 px targets on 375 px — below the 44 px rule) | 2 × 4 below 640 px (D-037; already fixed in v1) |
| Quick-add words | includes "final" (test) | "final" removed ("final draft"); see R-12 |
| Tests after their date | become overdue | *written* (never overdue), *Written* group |
| PWA manifest | `orientation: 'portrait'` | `any` (N-7) |
| CSP | none | strict CSP (N-6) |
| OCR data | fetched from jsDelivr on first use | bundled, same-origin (N-6) |
| Backup | version 1 | version 2; v1 still importable |
| Load, study plans, notifications, `.ics`, results, attachments | none | F-9 … F-14 |

### 9.2 Data migration v1 → v2 (Dexie `upgrade`)

1. Timetable `main` → new id; `name: 'Timetable'`; `validFrom` = the earlier of the Monday of the
   week it was last updated and the earliest task due date; `validTo: null`; `rotation =
   { weeks: 1, anchor: validFrom's Monday, anchorIndex: 0, skipHolidayWeeks: false }`.
2. `bells[i]` → `periods[i]` with new ids, `label: null`.
3. Each lesson → `{ id, week: 0, periodId: periods[period].id, span: 1, time: null, room ?? null }`.
   Adjacent identical lessons are **not** merged automatically (the student decides).
4. Subjects: `color` name → `hue` via the preset table (DESIGN §2.3); `stone` → `null`;
   `short: null`, `teacher: null`, `updatedAt = createdAt`.
5. Tasks: `due = { date: due, lessonId: lesson at (weekday(due), period) ?? null, time: bell start
   ?? null }`; add `subtasks: []`, `attachmentIds: []`, `reminders: null`, `estimateMin: null`;
   tests get `topics: [], plan: null, result: null`; assignments `plan: null`.
6. Settings: add `notifications`, default `reminders`, `study`, `lastBackupAt: null`.

Migration is tested against a v1 fixture database and a v1 backup file.

### 9.3 Suggested delivery order

1. Data model v2 + migration, 4 tabs, Snackbar, detail/quick-add split.
2. Multiple timetables, periods/spans/time overrides, rotation, holidays, review grid upgrades.
3. Steps, attachments, test results.
4. Load + heatmap, study-plan generator.
5. Notifications (native).
6. Backup v2, `.ics` export/import, bundled OCR data, perf budget in CI.
