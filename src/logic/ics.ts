import { fold } from '@/lib/text';
import { ICS_WEEKS } from './constants';
import { dueMoment } from './due';
import { isHoliday, occurrencesOn, type Occurrence } from './schedule';
import { addDays, dateRange, diffDays, isDateKey, minKey, minutesOf, mondayOf, timeOf, toDateKey, toHHmm, weekdayOf } from './time';
import type { AppData, DateKey, DraftCell, DraftTimetable, HHmm, Lesson, Schedule, Subject, Task, Timetable, Weekday } from './types';

/**
 * Calendar files (F-12, R-15). Export writes lessons as weekly series, tests and assignments at
 * their due moment and holidays as all-day events, all in floating local time to match R-1.
 * Import reads holidays (all-day events) and a draft timetable (weekly timed events).
 */

// ── Writing ──────────────────────────────────────────────────────────────────

/** RFC 5545 §3.3.11: backslash, semicolon, comma and newlines are escaped in TEXT values. */
export function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n|\r/g, '\\n');
}

const utf8Length = (s: string) => new TextEncoder().encode(s).length;

/** RFC 5545 §3.1: lines longer than 75 octets continue on lines starting with a space. */
export function foldLine(line: string): string {
  if (utf8Length(line) <= 75) return line;
  const parts: string[] = [];
  let current = '';
  let size = 0;
  for (const ch of line) {
    const n = utf8Length(ch);
    const limit = parts.length === 0 ? 75 : 74;
    if (size + n > limit) {
      parts.push(current);
      current = '';
      size = 0;
    }
    current += ch;
    size += n;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

const compactDate = (d: DateKey) => d.replace(/-/g, '');
const floating = (d: DateKey, t: HHmm) => `${compactDate(d)}T${t.replace(':', '')}00`;
const utcStamp = (now: Date) => now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

export interface IcsLabels {
  /** SUMMARY of a test or assignment. */
  task: (task: Task, subject: Subject | undefined) => string;
  calendarName: string;
}

const KIND_NAMES = { homework: 'homework', assignment: 'assignment', test: 'test' } as const;

export const ENGLISH_ICS_LABELS: IcsLabels = {
  task: (task, subject) => {
    const kind = KIND_NAMES[task.kind];
    if (subject && task.title) return `${subject.name} ${kind}: ${task.title}`;
    if (task.title) return task.title;
    return subject ? `${subject.name} ${kind}` : kind.charAt(0).toUpperCase() + kind.slice(1);
  },
  calendarName: 'TERM',
};

interface Segment {
  occs: Occurrence[];
  exdates: DateKey[];
}

/**
 * Split a lesson's occurrences into series that one RRULE can describe: every `interval` weeks,
 * with holiday dates as EXDATEs. A skipped holiday week shifts the rotation, so the series
 * restarts after it (D-023).
 */
function segments(occs: Occurrence[], intervalWeeks: number, schedule: Schedule): Segment[] {
  const out: Segment[] = [];
  for (const occ of occs) {
    const seg = out[out.length - 1];
    const last = seg?.occs[seg.occs.length - 1];
    if (seg && last) {
      const skipped: DateKey[] = [];
      let expected = addDays(last.date, intervalWeeks * 7);
      while (expected < occ.date && isHoliday(expected, schedule.holidays)) {
        skipped.push(expected);
        expected = addDays(expected, intervalWeeks * 7);
      }
      if (expected === occ.date && occ.startTime === last.startTime && occ.endTime === last.endTime) {
        seg.exdates.push(...skipped);
        seg.occs.push(occ);
        continue;
      }
    }
    out.push({ occs: [occ], exdates: [] });
  }
  return out;
}

/**
 * A lesson's series in the export range. Series boundaries are worked out over the timetable's
 * whole life, so they — and the UIDs derived from them — stay the same when the file is exported
 * again next week: calendars update the events instead of duplicating them.
 */
function lessonEvents(t: Timetable, lesson: Lesson, from: DateKey, until: DateKey, schedule: Schedule, subjects: Map<string, Subject>, stamp: string): string[][] {
  const end = t.validTo ? minKey(until, t.validTo) : until;
  const own: Schedule = { timetables: [t], holidays: schedule.holidays };
  const occs: Occurrence[] = [];
  for (const date of dateRange(t.validFrom, end)) {
    if (weekdayOf(date) !== lesson.day) continue;
    const occ = occurrencesOn(date, own).find((o) => o.lesson.id === lesson.id);
    if (occ) occs.push(occ);
  }
  const subject = subjects.get(lesson.subjectId);
  return segments(occs, t.rotation.weeks, own).flatMap((seg, index) => {
    const visible = seg.occs.filter((o) => o.date >= from);
    const first = visible[0];
    const last = visible[visible.length - 1];
    if (!first || !last) return [];
    const series = seg.occs[0] as Occurrence;
    const lines = [
      'BEGIN:VEVENT',
      `UID:${index === 0 ? lesson.id : `${lesson.id}-${compactDate(series.date)}`}@term`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${floating(first.date, first.startTime)}`,
      `DTEND:${floating(first.date, first.endTime)}`,
    ];
    // Always a rule, even for one occurrence: it carries the rotation interval for re-import.
    lines.push(`RRULE:FREQ=WEEKLY;INTERVAL=${t.rotation.weeks};UNTIL=${floating(last.date, first.startTime)}`);
    const exdates = seg.exdates.filter((d) => d > first.date && d < last.date);
    if (exdates.length) lines.push(`EXDATE:${exdates.map((d) => floating(d, first.startTime)).join(',')}`);
    lines.push(`SUMMARY:${escapeText(subject?.name ?? '—')}`);
    if (lesson.room) lines.push(`LOCATION:${escapeText(lesson.room)}`);
    lines.push('END:VEVENT');
    return [lines];
  });
}

/** Default length of a task event that has a time but no lesson. */
const TASK_EVENT_MINUTES = 45;

function taskEvent(task: Task, schedule: Schedule, subjects: Map<string, Subject>, labels: IcsLabels, stamp: string): string[] {
  const lines = ['BEGIN:VEVENT', `UID:${task.id}@term`, `DTSTAMP:${stamp}`];
  const occ = task.due.lessonId ? occurrencesOn(task.due.date, schedule).find((o) => o.lesson.id === task.due.lessonId) : undefined;
  if (occ) {
    lines.push(`DTSTART:${floating(occ.date, occ.startTime)}`, `DTEND:${floating(occ.date, occ.endTime)}`);
  } else if (task.due.time) {
    const start = dueMoment(task, schedule);
    const end = toHHmm(minutesOf(timeOf(start)) + TASK_EVENT_MINUTES);
    lines.push(`DTSTART:${floating(toDateKey(start), timeOf(start))}`, `DTEND:${floating(toDateKey(start), end)}`);
  } else {
    lines.push(`DTSTART;VALUE=DATE:${compactDate(task.due.date)}`, `DTEND;VALUE=DATE:${compactDate(addDays(task.due.date, 1))}`);
  }
  lines.push(`SUMMARY:${escapeText(labels.task(task, task.subjectId ? subjects.get(task.subjectId) : undefined))}`);
  if (task.notes.trim()) lines.push(`DESCRIPTION:${escapeText(task.notes.trim())}`);
  lines.push('END:VEVENT');
  return lines;
}

/**
 * The calendar file for the next `weeks` weeks (26 by default, D-023): lessons, open tests and
 * assignments, and holidays. Homework is left out — it would flood a calendar.
 */
export function exportIcs(
  data: Pick<AppData, 'subjects' | 'timetables' | 'holidays' | 'tasks'>,
  options: { now: Date; weeks?: number; labels?: IcsLabels },
): string {
  const labels = options.labels ?? ENGLISH_ICS_LABELS;
  const from = toDateKey(options.now);
  const until = addDays(from, (options.weeks ?? ICS_WEEKS) * 7 - 1);
  const stamp = utcStamp(options.now);
  const subjects = new Map(data.subjects.map((s) => [s.id, s]));
  const schedule: Schedule = { timetables: data.timetables, holidays: data.holidays };
  const events: string[][] = [];

  for (const t of data.timetables) {
    if (t.validFrom > until || (t.validTo != null && t.validTo < from)) continue;
    for (const lesson of t.lessons) events.push(...lessonEvents(t, lesson, from, until, schedule, subjects, stamp));
  }
  for (const h of data.holidays) {
    if (h.end < from || h.start > until) continue;
    events.push([
      'BEGIN:VEVENT',
      `UID:${h.id}@term`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compactDate(h.start)}`,
      `DTEND;VALUE=DATE:${compactDate(addDays(h.end, 1))}`,
      `SUMMARY:${escapeText(h.name)}`,
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    ]);
  }
  for (const task of data.tasks) {
    if (task.kind === 'homework' || task.doneAt != null || task.due.date < from || task.due.date > until) continue;
    events.push(taskEvent(task, schedule, subjects, labels, stamp));
  }

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TERM//School planner//EN',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeText(labels.calendarName)}`,
    ...events.flat(),
    'END:VCALENDAR',
  ];
  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}

// ── Reading ──────────────────────────────────────────────────────────────────

interface Property {
  name: string;
  params: Record<string, string>;
  value: string;
}

type Event = Map<string, Property[]>;

function unescapeText(value: string): string {
  return value.replace(/\\([\\;,nN])/g, (_, c: string) => (c === 'n' || c === 'N' ? '\n' : c));
}

function parseProperty(line: string): Property | null {
  // NAME;PARAM=VALUE;PARAM="quoted:value":VALUE — the first colon outside quotes ends the parameters.
  let inQuotes = false;
  let colon = -1;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQuotes = !inQuotes;
    else if (c === ':' && !inQuotes) {
      colon = i;
      break;
    }
  }
  if (colon < 0) return null;
  const [name = '', ...rawParams] = line.slice(0, colon).split(';');
  const params: Record<string, string> = {};
  for (const p of rawParams) {
    const eq = p.indexOf('=');
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, '');
  }
  return { name: name.toUpperCase(), params, value: line.slice(colon + 1) };
}

function parseEvents(text: string): Event[] {
  const lines = text.replace(/\r\n[ \t]|\n[ \t]|\r[ \t]/g, '').split(/\r\n|\n|\r/);
  const events: Event[] = [];
  let current: Event | null = null;
  let depth = 0;
  for (const line of lines) {
    const prop = parseProperty(line);
    if (!prop) continue;
    if (prop.name === 'BEGIN') {
      if (prop.value.toUpperCase() === 'VEVENT' && depth === 0) current = new Map();
      else if (current) depth++;
    } else if (prop.name === 'END') {
      if (current && depth > 0) depth--;
      else if (current && prop.value.toUpperCase() === 'VEVENT') {
        events.push(current);
        current = null;
      }
    } else if (current && depth === 0) {
      current.set(prop.name, [...(current.get(prop.name) ?? []), prop]);
    }
  }
  return events;
}

interface Moment {
  date: DateKey;
  time: HHmm | null;
}

/** DATE, floating DATE-TIME, TZID (read as wall-clock time) or UTC (converted to local time). */
function parseMoment(prop: Property | undefined): Moment | null {
  if (!prop) return null;
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(prop.value.trim());
  if (!m) return null;
  const date = `${m[1]}-${m[2]}-${m[3]}`;
  if (!isDateKey(date)) return null;
  if (m[4] == null || prop.params.VALUE === 'DATE') return { date, time: null };
  if (m[7]) {
    const utc = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])));
    return { date: toDateKey(utc), time: timeOf(utc) };
  }
  const minutes = Number(m[4]) * 60 + Number(m[5]);
  return minutes < 24 * 60 ? { date, time: toHHmm(minutes) } : null;
}

const BYDAY: Record<string, Weekday> = { MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6, SU: 7 };

/** Words that make an all-day event look like a break (DESIGN §4.13). */
const HOLIDAY_WORDS = [
  'holiday', 'holidays', 'break', 'vacation', 'half term', 'half-term', 'inset', 'bank holiday', 'day off', 'no school',
  'ferien', 'feiertag', 'urlaub', 'schulfrei', 'unterrichtsfrei', 'brückentag',
  'празник', 'распуст', 'одмор', 'неработен', 'ваканција',
].map(fold);

export interface HolidayCandidate {
  name: string;
  start: DateKey;
  end: DateKey;
  /** Pre-ticked: several days long, or named like a break. */
  suggested: boolean;
}

export interface IcsImport {
  holidays: HolidayCandidate[];
  /** Weekly timed events as a timetable draft for the review grid; null when there are none. */
  draft: DraftTimetable | null;
}

interface Weekly {
  day: Weekday;
  start: HHmm;
  end: HHmm;
  interval: number;
  monday: DateKey;
  subject: string;
  room: string | null;
}

function draftFrom(weekly: Weekly[]): DraftTimetable | null {
  if (weekly.length === 0) return null;
  const weeks = Math.max(...weekly.map((w) => w.interval)) as 1 | 2 | 3 | 4;
  const anchor = weekly.map((w) => w.monday).sort()[0] as DateKey;
  const starts = [...new Set(weekly.map((w) => w.start))].sort();
  const periods = starts.map((start, i) => {
    const ends = weekly.filter((w) => w.start === start).map((w) => minutesOf(w.end));
    const next = starts[i + 1];
    let end = Math.min(...ends);
    if (next && end > minutesOf(next)) end = minutesOf(next);
    return { start, end: toHHmm(end) };
  });
  const cells: DraftCell[] = [];
  const taken = new Set<string>();
  for (const w of weekly) {
    if (weeks % w.interval !== 0) continue;
    const period = starts.indexOf(w.start);
    const span = Math.max(1, starts.filter((s) => s >= w.start && s < w.end).length);
    const first = ((Math.round(diffDays(w.monday, anchor) / 7) % w.interval) + w.interval) % w.interval;
    for (let week = first; week < weeks; week += w.interval) {
      const key = `${week}:${w.day}:${period}`;
      if (taken.has(key)) continue;
      taken.add(key);
      cells.push({ day: w.day, week, period, span, subject: w.subject, room: w.room, confidence: 1 });
    }
  }
  const days = [...new Set(cells.map((c) => c.day))].sort();
  return { days, weeks, periods, cells, holidays: [] };
}

export function importIcs(text: string): IcsImport {
  const holidays: HolidayCandidate[] = [];
  const weekly: Weekly[] = [];
  /** TERM writes a lesson whose series restarts after a holiday week as "<id>-<date>@term": one lesson. */
  const seenLessons = new Set<string>();
  const events = parseEvents(text)
    .map((ev) => ({ ev, start: parseMoment(ev.get('DTSTART')?.[0]) }))
    .sort((a, b) => (a.start?.date ?? '').localeCompare(b.start?.date ?? ''));
  for (const { ev, start } of events) {
    if (!start) continue;
    const end = parseMoment(ev.get('DTEND')?.[0]);
    const summary = unescapeText(ev.get('SUMMARY')?.[0]?.value ?? '').trim();
    if (start.time == null) {
      // All-day: DTEND is exclusive.
      const last = end && end.date > start.date ? addDays(end.date, -1) : start.date;
      const name = summary || 'Holiday';
      const folded = fold(name);
      const multiDay = last > start.date;
      holidays.push({ name, start: start.date, end: last, suggested: multiDay || HOLIDAY_WORDS.some((w) => folded.includes(w)) });
      continue;
    }
    const rule = ev.get('RRULE')?.[0]?.value;
    if (!rule || !summary) continue;
    const uid = ev.get('UID')?.[0]?.value.replace(/-\d{8}(@term)$/, '$1');
    if (uid?.endsWith('@term')) {
      if (seenLessons.has(uid)) continue;
      seenLessons.add(uid);
    }
    const parts = Object.fromEntries(rule.split(';').map((p) => p.split('=') as [string, string]));
    if (parts.FREQ?.toUpperCase() !== 'WEEKLY') continue;
    const interval = Number(parts.INTERVAL ?? 1);
    if (!Number.isInteger(interval) || interval < 1 || interval > 4) continue;
    const endTime = end?.time && end.date === start.date && end.time > start.time ? end.time : toHHmm(minutesOf(start.time) + 45);
    const days = parts.BYDAY
      ? parts.BYDAY.split(',').flatMap((d) => {
          const day = BYDAY[d.trim().slice(-2).toUpperCase()];
          return day ? [day] : [];
        })
      : [weekdayOf(start.date)];
    const location = unescapeText(ev.get('LOCATION')?.[0]?.value ?? '').trim();
    for (const day of days) {
      weekly.push({ day, start: start.time, end: endTime, interval, monday: mondayOf(start.date), subject: summary, room: location || null });
    }
  }
  holidays.sort((a, b) => a.start.localeCompare(b.start));
  return { holidays, draft: draftFrom(weekly) };
}
