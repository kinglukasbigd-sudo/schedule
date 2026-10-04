import { uid } from '@/lib/id';
import { fold } from '@/lib/text';
import type * as V1 from '@/domain/types';
import { dueAtLesson } from '@/logic/due';
import { occurrencesOn, resolveWeekType, timetableFor } from '@/logic/schedule';
import { hueOfPreset, pickHue, presetOf } from '@/logic/subjects';
import { nextTimetableName, normalizePeriods } from '@/logic/timetable';
import { dateKey, isDateKey, mondayOf, toDateKey } from '@/logic/time';
import type { DateKey, Due, Holiday, ID, Lesson, Schedule, Subject, Task, TaskKind, Timetable } from '@/logic/types';

/**
 * The v1 screens' view of v2 data (D-045). Stored data is the v2 model; the v1 screens keep
 * working on their old shapes — one timetable, period indexes, named colours — until each
 * screen is rebuilt on the v2 model. Everything here is pure, so it is unit-tested directly.
 */

export function subjectView(s: Subject): V1.Subject {
  return { id: s.id, name: s.name, color: presetOf(s.hue), createdAt: s.createdAt };
}

/** The timetable the v1 screens show: the one covering `date`, else the next one, else the latest. */
export function currentTimetable(timetables: readonly Timetable[], date: DateKey): Timetable | undefined {
  const covering = timetableFor(date, timetables);
  if (covering) return covering;
  const sorted = [...timetables].sort((a, b) => a.validFrom.localeCompare(b.validFrom));
  return sorted.find((t) => t.validFrom > date) ?? sorted[sorted.length - 1];
}

/** The rotation week the v1 screens show and edit for a timetable. */
export function viewWeek(t: Timetable, holidays: readonly Holiday[], date: DateKey): number {
  return resolveWeekType(date, t, holidays).index;
}

/** One timetable as v1 saw it: bells by index, lessons by period (a double lesson fills both). */
export function timetableView(t: Timetable, week: number): V1.Timetable {
  const index = new Map(t.periods.map((p, i) => [p.id, i]));
  const lessons: V1.Lesson[] = [];
  for (const l of t.lessons) {
    const first = index.get(l.periodId);
    if (first == null || l.week !== week) continue;
    for (let p = first; p < Math.min(first + l.span, t.periods.length); p++) {
      lessons.push({ day: l.day, period: p, subjectId: l.subjectId, ...(l.room ? { room: l.room } : {}) });
    }
  }
  return {
    id: 'main',
    days: [...t.days],
    bells: t.periods.map((p) => ({ start: p.start, end: p.end })),
    lessons,
    updatedAt: t.updatedAt,
  };
}

/** A task's period index on its due date: its lesson's first period, else a period starting at its time. */
export function taskView(task: Task, timetables: readonly Timetable[]): V1.Task {
  const t = timetableFor(task.due.date, timetables);
  let period: number | null = null;
  if (t) {
    const lesson = task.due.lessonId ? t.lessons.find((l) => l.id === task.due.lessonId) : undefined;
    const byLesson = lesson ? t.periods.findIndex((p) => p.id === lesson.periodId) : -1;
    const byTime = task.due.time ? t.periods.findIndex((p) => p.start === task.due.time) : -1;
    period = byLesson >= 0 ? byLesson : byTime >= 0 ? byTime : null;
  }
  return {
    id: task.id,
    kind: task.kind,
    title: task.title,
    subjectId: task.subjectId,
    due: task.due.date,
    period,
    notes: task.notes,
    doneAt: task.doneAt,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

/** v1's (date, period) as a v2 due: the lesson in that period that day, else the period's start. */
export function dueFromView(date: string, period: number | null, schedule: Schedule): Due {
  const day = isDateKey(date) ? date : dateKey(date);
  if (period == null) return { date: day, lessonId: null, time: null };
  const occ = occurrencesOn(day, schedule).find((o) => o.periodIndex === period);
  if (occ) return dueAtLesson(occ);
  const t = timetableFor(day, schedule.timetables);
  return { date: day, lessonId: null, time: t?.periods[period]?.start ?? null };
}

export interface TaskInput {
  kind: TaskKind;
  title: string;
  subjectId: string | null;
  due: string;
  period: number | null;
  notes?: string;
}

/** Changing kind keeps what the new kind supports; topics, plan and result go (F-5). */
export function withKind(task: Task, kind: TaskKind): Task {
  if (task.kind === kind) return task;
  const { topics: _t, plan, result: _r, ...base } = task as Task & { topics?: string[]; plan?: unknown; result?: unknown };
  if (kind === 'test') return { ...base, kind, topics: [], plan: (plan as never) ?? null, result: null };
  if (kind === 'assignment') return { ...base, kind, plan: (plan as never) ?? null };
  return { ...base, kind };
}

export function taskFromInput(input: TaskInput, schedule: Schedule, now: number, id: ID = uid()): Task {
  const base = {
    id,
    title: input.title.trim(),
    subjectId: input.subjectId,
    due: dueFromView(input.due, input.period, schedule),
    notes: input.notes ?? '',
    subtasks: [],
    attachmentIds: [],
    reminders: null,
    estimateMin: null,
    doneAt: null,
    createdAt: now,
    updatedAt: now,
  };
  return withKind({ ...base, kind: 'homework' }, input.kind);
}

export function updatedTask(task: Task, patch: Partial<TaskInput>, schedule: Schedule, now: number): Task {
  let next: Task = withKind(task, patch.kind ?? task.kind);
  if (patch.title != null) next = { ...next, title: patch.title.trim() };
  if (patch.subjectId !== undefined) next = { ...next, subjectId: patch.subjectId };
  if (patch.notes != null) next = { ...next, notes: patch.notes };
  if (patch.due != null || patch.period !== undefined) {
    const view = taskView(task, schedule.timetables);
    const date = patch.due ?? view.due;
    const period = patch.period !== undefined ? patch.period : view.period;
    if (date !== view.due || period !== view.period) next = { ...next, due: dueFromView(date, period, schedule) };
  }
  return { ...next, updatedAt: now };
}

/** Subjects a draft needs that don't exist yet, with hues assigned in order of first appearance. */
export function newSubjectsFor(names: readonly string[], existing: readonly Subject[], now: number, newId: () => ID = uid): Subject[] {
  const known = new Set(existing.map((s) => fold(s.name.trim())));
  const hues = existing.map((s) => s.hue);
  const created: Subject[] = [];
  for (const raw of names) {
    const name = raw.trim();
    const key = fold(name);
    if (!name || known.has(key)) continue;
    known.add(key);
    const hue = pickHue(hues);
    hues.push(hue);
    created.push({ id: newId(), name: name.slice(0, 40), short: null, hue, teacher: null, createdAt: now, updatedAt: now });
  }
  return created;
}

/**
 * A v1 draft saved into a v2 timetable. Period ids are kept by position and lesson ids by slot
 * while the subject stays the same (R-4), so tasks linked to lessons survive an edit. Lessons of
 * other rotation weeks are left alone.
 */
export function timetableFromDraft(
  draft: V1.DraftTimetable,
  existing: Timetable | undefined,
  context: { subjects: readonly Subject[]; others: readonly Timetable[]; week: number; today: DateKey; now: number; newId?: () => ID },
): Timetable {
  const newId = context.newId ?? uid;
  const ids = existing?.periods.map((p) => p.id) ?? [];
  let n = 0;
  const periods = normalizePeriods(draft.bells, () => ids[n++] ?? newId());
  const byName = new Map(context.subjects.map((s) => [fold(s.name.trim()), s.id]));
  const keep = (existing?.lessons ?? []).filter((l) => l.week !== context.week && periods.some((p) => p.id === l.periodId));
  const previous = new Map(
    (existing?.lessons ?? []).filter((l) => l.week === context.week).map((l) => [`${l.day}:${l.periodId}:${l.subjectId}`, l]),
  );
  const taken = new Set<string>();
  const lessons: Lesson[] = [...keep];
  for (const cell of draft.cells) {
    const period = periods[cell.period];
    const subjectId = byName.get(fold(cell.subject.trim()));
    const slot = `${cell.day}:${cell.period}`;
    if (!period || !subjectId || !draft.days.includes(cell.day) || taken.has(slot)) continue;
    taken.add(slot);
    const old = previous.get(`${cell.day}:${period.id}:${subjectId}`);
    lessons.push({
      id: old?.id ?? newId(),
      subjectId,
      day: cell.day,
      week: context.week,
      periodId: period.id,
      span: 1,
      time: old?.time ?? null,
      room: cell.room?.trim() ? cell.room.trim() : null,
    });
  }
  const validFrom = existing?.validFrom ?? mondayOf(context.today);
  return {
    id: existing?.id ?? newId(),
    name: existing?.name ?? nextTimetableName(context.others),
    validFrom,
    validTo: existing?.validTo ?? null,
    days: [...new Set(draft.days)].sort(),
    periods: periods.length ? periods : normalizePeriods([{ start: '08:00', end: '08:45' }], newId),
    rotation: existing?.rotation ?? { weeks: 1, anchor: mondayOf(validFrom), anchorIndex: 0, skipHolidayWeeks: false },
    lessons,
    createdAt: existing?.createdAt ?? context.now,
    updatedAt: context.now,
  };
}

/** v1 colour name → v2 hue (stone and unknown names are neutral). */
export const hueOfColor = (color: string): number | null => hueOfPreset(color);

/** Today's date key, for views that depend on the current timetable. */
export const todayKey = (): DateKey => toDateKey(new Date());
