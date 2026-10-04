import type { Bell, DraftCell, DraftTimetable, Weekday } from '@/domain/types';
import { isBreakText, matchDay } from './days';
import { extractTimes, finalizeDraft, splitRoom } from './normalize';

/**
 * Text timetables, in the forms people actually type or paste:
 *
 *   Monday: Math, English, Biology        (one line per day)
 *   Mon\n1. Math\n2. English              (day header followed by lines)
 *   \tMon\tTue …\n08:00\tMath\tBio …      (spreadsheet paste, days across)
 *   Mon\tMath\tBio …                      (spreadsheet paste, days down)
 */
export function parseTimetableText(input: string): DraftTimetable | null {
  const lines = input
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .filter((l) => l.trim().length > 0);
  if (lines.length === 0) return null;
  return parseSpreadsheet(lines) ?? parseDayLines(lines) ?? parseUnlabelled(lines);
}

/** One school day typed as a list: "Math, English, -, Bio" → entries by period (empty = free). */
export function parseDayList(text: string): { subject: string; room?: string; start?: string; end?: string; period?: number }[] {
  const parts = text
    .replace(/\r/g, '')
    .split(/[,;|\t\n]|\s{3,}/)
    .map((p) => p.trim());
  // Trailing empties are noise ("Math, Bio,"), interior empties are free periods.
  while (parts.length && !parts[parts.length - 1]) parts.pop();
  return parts.map((p) => parseEntry(p));
}

function parseEntry(raw: string): { subject: string; room?: string; start?: string; end?: string; period?: number } {
  let text = raw.trim();
  const times = extractTimes(text);
  text = text.replace(/\d{1,2}[:.]\d{2}\s*(?:[-–—]\s*\d{1,2}[:.]\d{2})?/g, ' ').trim();
  let period: number | undefined;
  const num = /^(\d{1,2})\s*[.)]\s*(.*)$/.exec(text) ?? /^(\d{1,2})\s+(.*)$/.exec(text);
  if (num?.[2]) {
    period = Number(num[1]) - 1;
    text = num[2];
  }
  text = text.replace(/^[-–—:]\s*/, '');
  if (!text || isBreakText(text)) return { subject: '', ...times, ...(period != null ? { period } : {}) };
  const { subject, room } = splitRoom(text);
  return { subject, ...(room ? { room } : {}), ...times, ...(period != null ? { period } : {}) };
}

function cellsFromEntries(
  day: Weekday,
  entries: ReturnType<typeof parseDayList>,
  bells: (Partial<Bell> | undefined)[],
): DraftCell[] {
  const cells: DraftCell[] = [];
  let index = 0;
  for (const e of entries) {
    const period = e.period != null && e.period >= 0 && e.period < 16 ? e.period : index;
    index = period + 1;
    if (e.start && !bells[period]?.start) bells[period] = { start: e.start, ...(e.end ? { end: e.end } : {}) };
    if (e.subject) cells.push({ day, period, subject: e.subject, ...(e.room ? { room: e.room } : {}) });
  }
  return cells;
}

function splitCells(line: string): string[] {
  if (line.includes('\t')) return line.split('\t').map((c) => c.trim());
  if (line.includes(';')) return line.split(';').map((c) => c.trim());
  if ((line.match(/,/g) ?? []).length >= 2) return line.split(',').map((c) => c.trim());
  return line.split(/\s{2,}/).map((c) => c.trim());
}

function parseSpreadsheet(lines: string[]): DraftTimetable | null {
  const rows = lines.map(splitCells);
  if (rows.filter((r) => r.length >= 3).length < 2) return null;

  // Days across the header row.
  const headerIdx = rows.findIndex((r) => r.filter((c) => matchDay(c)).length >= 2);
  if (headerIdx >= 0) {
    const header = rows[headerIdx] as string[];
    const dayCols = header.map((c) => matchDay(c));
    const bells: (Partial<Bell> | undefined)[] = [];
    const cells: DraftCell[] = [];
    let period = 0;
    for (const row of rows.slice(headerIdx + 1)) {
      const label = row.find((_, i) => dayCols[i] == null) ?? '';
      const times = extractTimes(label);
      const lessonTexts = row.filter((_, i) => dayCols[i] != null).join(' ');
      if (!lessonTexts.trim() || (isBreakText(lessonTexts) && !times.start)) continue;
      if (row.every((c, i) => dayCols[i] == null || !c || isBreakText(c))) continue;
      if (times.start) bells[period] = times;
      row.forEach((c, i) => {
        const day = dayCols[i];
        if (day == null || !c) return;
        const { subject, room } = splitRoom(c);
        cells.push({ day, period, subject, ...(room ? { room } : {}) });
      });
      period++;
    }
    return finalizeDraft(cells, bells, dayCols.filter((d): d is Weekday => d != null));
  }

  // Days down the first column.
  const dayRows = rows.filter((r) => r[0] && matchDay(r[0]));
  if (dayRows.length >= 2) {
    const headerRow = rows.find((r) => !(r[0] && matchDay(r[0])));
    const bells: (Partial<Bell> | undefined)[] = [];
    headerRow?.slice(1).forEach((c, i) => {
      const t = extractTimes(c);
      if (t.start) bells[i] = t;
    });
    const cells: DraftCell[] = [];
    for (const row of dayRows) {
      const day = matchDay(row[0] as string) as Weekday;
      row.slice(1).forEach((c, period) => {
        if (!c) return;
        const { subject, room } = splitRoom(c);
        cells.push({ day, period, subject, ...(room ? { room } : {}) });
      });
    }
    return finalizeDraft(cells, bells);
  }
  return null;
}

function parseDayLines(lines: string[]): DraftTimetable | null {
  const bells: (Partial<Bell> | undefined)[] = [];
  const cells: DraftCell[] = [];
  const seen = new Set<Weekday>();
  let current: Weekday | null = null;
  let pending: string[] = [];

  const flush = () => {
    if (current != null && pending.length) cells.push(...cellsFromEntries(current, parseDayList(pending.join('\n')), bells));
    pending = [];
  };

  for (const line of lines) {
    const m = /^\s*([\p{L}.]+)\s*([:\-–—]\s*|\s+|$)(.*)$/u.exec(line);
    let day = m ? matchDay(m[1] as string) : null;
    // "Fr" alone on a line is more likely French than Friday; short forms need "Fr:" or content.
    if (day != null && m && (m[1] as string).replace('.', '').length <= 2 && !m[2]?.includes(':') && !m[3]?.trim()) {
      day = null;
    }
    if (day != null && m) {
      flush();
      current = day;
      seen.add(day);
      if (m[3]?.trim()) pending.push(m[3]);
    } else if (current != null) {
      pending.push(line);
    }
  }
  flush();
  if (seen.size === 0) return null;
  return finalizeDraft(cells, bells, [...seen]);
}

/** No day names at all: each line is a school day, starting Monday. */
function parseUnlabelled(lines: string[]): DraftTimetable | null {
  if (lines.length > 7) return null;
  const bells: (Partial<Bell> | undefined)[] = [];
  const cells = lines.flatMap((line, i) => cellsFromEntries((i + 1) as Weekday, parseDayList(line), bells));
  return finalizeDraft(cells, bells);
}

/** The onboarding form: one free-text field per weekday. */
export function parseDayFields(fields: Partial<Record<Weekday, string>>): DraftTimetable | null {
  const bells: (Partial<Bell> | undefined)[] = [];
  const cells: DraftCell[] = [];
  const days: Weekday[] = [];
  for (const [key, text] of Object.entries(fields)) {
    const day = Number(key) as Weekday;
    if (!text?.trim()) continue;
    days.push(day);
    cells.push(...cellsFromEntries(day, parseDayList(text), bells));
  }
  return finalizeDraft(cells, bells, days);
}
