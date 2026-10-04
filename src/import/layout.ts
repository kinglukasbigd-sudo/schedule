import type { Bell, DraftCell, DraftTimetable, Weekday } from '@/domain/types';
import { isBreakText, matchDay } from './days';
import { extractTimes, finalizeDraft, isRoomText, splitRoom } from './normalize';

/** A recognised word (or text run) with its box in page coordinates, y growing downwards. */
export interface WordBox {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface Box extends WordBox {
  /** The untransposed box, used to restore reading order inside a cell. */
  orig: WordBox;
  cx: number;
  cy: number;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s[Math.floor(s.length / 2)] as number) : 0;
};

function toBox(w: WordBox, transpose: boolean): Box {
  const b = transpose ? { text: w.text, x0: w.y0, y0: w.x0, x1: w.y1, y1: w.x1 } : { ...w };
  return { ...b, orig: w, cx: (b.x0 + b.x1) / 2, cy: (b.y0 + b.y1) / 2 };
}

/** Group values into clusters where neighbours are within `tol`. Returns clusters of items. */
function cluster<T>(items: T[], key: (t: T) => number, tol: number): T[][] {
  const sorted = [...items].sort((a, b) => key(a) - key(b));
  const out: T[][] = [];
  let cur: T[] = [];
  let last = -Infinity;
  for (const it of sorted) {
    if (cur.length && key(it) - last > tol) {
      out.push(cur);
      cur = [];
    }
    cur.push(it);
    last = key(it);
  }
  if (cur.length) out.push(cur);
  return out;
}

interface Header {
  days: { day: Weekday; box: Box }[];
  bottom: number;
}

/** Find the row of day names (in the given orientation) with the most distinct days. */
function findHeader(boxes: Box[], lineTol: number): Header | null {
  const dayBoxes = boxes.filter((b) => matchDay(b.text) != null);
  let best: Header | null = null;
  for (const row of cluster(dayBoxes, (b) => b.cy, lineTol)) {
    const byDay = new Map<Weekday, Box>();
    for (const b of row.sort((a, b2) => a.cx - b2.cx)) {
      const d = matchDay(b.text) as Weekday;
      if (!byDay.has(d)) byDay.set(d, b);
    }
    if (byDay.size < 2) continue;
    const days = [...byDay.entries()].map(([day, box]) => ({ day, box })).sort((a, b) => a.box.cx - b.box.cx);
    if (!best || days.length > best.days.length) {
      best = { days, bottom: Math.max(...days.map((d) => d.box.y1)) };
    }
  }
  return best;
}

/** Midpoint boundaries around sorted centres. */
function bounds(centres: number[]): [number, number][] {
  return centres.map((c, i) => {
    const prev = centres[i - 1];
    const next = centres[i + 1];
    const leftGap = prev != null ? (c - prev) / 2 : next != null ? (next - c) / 2 : Infinity;
    const rightGap = next != null ? (next - c) / 2 : leftGap;
    return [c - leftGap, c + rightGap];
  });
}

/** Reading order inside a cell, using the original (untransposed) coordinates. */
function cellLines(words: Box[], lineTol: number): string[] {
  return cluster(words, (w) => (w.orig.y0 + w.orig.y1) / 2, lineTol).map((line) =>
    line
      .sort((a, b) => a.orig.x0 - b.orig.x0)
      .map((w) => w.text)
      .join(' ')
      .trim(),
  );
}

function subjectAndRoom(lines: string[]): { subject: string; room?: string } | null {
  const useful = lines.filter((l) => /[\p{L}\p{N}]/u.test(l));
  let room: string | undefined;
  let subject: string | undefined;
  for (const line of useful) {
    if (isRoomText(line)) {
      room ??= line;
      continue;
    }
    if (subject == null) {
      const split = splitRoom(line);
      subject = split.subject;
      room ??= split.room;
    }
  }
  if (!subject) return null;
  return { subject, ...(room ? { room } : {}) };
}

interface Attempt {
  draft: DraftTimetable;
  score: number;
}

function attempt(words: WordBox[], transpose: boolean): Attempt | null {
  const boxes = words.filter((w) => /[\p{L}\p{N}]/u.test(w.text)).map((w) => toBox(w, transpose));
  if (boxes.length < 4) return null;
  // Line tolerance is based on text height in the original orientation.
  const textHeight = median(words.map((w) => w.y1 - w.y0)) || 10;
  const lineTol = textHeight * 0.6;
  // In this orientation, "header row" tolerance uses the transposed axis.
  const headerTol = transpose ? median(words.map((w) => w.x1 - w.x0)) * 0.5 : lineTol;

  const header = findHeader(boxes, headerTol);
  if (!header) return null;

  const headerSet = new Set(header.days.map((d) => d.box));
  const colBounds = bounds(header.days.map((d) => d.box.cx));
  const left = colBounds[0]?.[0] ?? 0;
  const right = colBounds[colBounds.length - 1]?.[1] ?? Infinity;
  const content = boxes.filter((b) => !headerSet.has(b) && b.cy > header.bottom);

  // Row anchors come from the label column (times / period numbers / break labels).
  const labels = content.filter((b) => b.cx < left);
  const labelRows = cluster(labels, (b) => b.cy, transpose ? headerTol * 2 : lineTol).map((row) => {
    const text = row
      .sort((a, b) => a.orig.y0 - b.orig.y0 || a.orig.x0 - b.orig.x0)
      .map((b) => b.text)
      .join(' ');
    return { cy: row.reduce((s, b) => s + b.cy, 0) / row.length, text, times: extractTimes(text) };
  });
  let anchors = labelRows.filter((r) => r.times.start || /^\s*\d{1,2}\s*[.)]?\s*$/.test(r.text) || isBreakText(r.text));
  const cellsArea = content.filter((b) => b.cx >= left && b.cx <= right);

  if (anchors.length < 2) {
    // No label column: every distinct text line is a row, merging lines that are clearly one cell.
    const lines = cluster(cellsArea, (b) => b.cy, lineTol).map((l) => ({
      cy: l.reduce((s, b) => s + b.cy, 0) / l.length,
      isRoom: l.every((b) => isRoomText(b.text)),
    }));
    anchors = lines.filter((l) => !l.isRoom).map((l) => ({ cy: l.cy, text: '', times: {} }));
  }
  if (anchors.length === 0) return null;

  const rowBounds = bounds(anchors.map((a) => a.cy));
  const grid = new Map<string, Box[]>();
  for (const b of cellsArea) {
    if (isBreakText(b.text) && b.text.length > 1) continue;
    const col = colBounds.findIndex(([l, r]) => b.cx >= l && b.cx < r);
    const row = rowBounds.findIndex(([t, btm]) => b.cy >= t && b.cy < btm);
    if (col < 0 || row < 0) continue;
    const key = `${row}:${col}`;
    grid.set(key, [...(grid.get(key) ?? []), b]);
  }

  const cells: DraftCell[] = [];
  const bells: (Partial<Bell> | undefined)[] = anchors.map((a) => (isBreakText(a.text) ? undefined : a.times));
  for (const [key, ws] of grid) {
    const [row, col] = key.split(':').map(Number) as [number, number];
    if (isBreakText(anchors[row]?.text ?? '') && anchors[row]?.text) continue;
    const parsed = subjectAndRoom(cellLines(ws, lineTol));
    const day = header.days[col]?.day;
    if (!parsed || day == null) continue;
    cells.push({ day, period: row, ...parsed });
  }

  const draft = finalizeDraft(cells, bells, header.days.map((d) => d.day));
  if (!draft) return null;
  return { draft, score: header.days.length * 100 + draft.cells.length };
}

/**
 * Turn positioned words into a timetable. Handles days across the top (common) and days
 * down the side (by transposing the page). Returns null when no grid structure is found.
 */
export function parseLayout(words: WordBox[]): DraftTimetable | null {
  const a = attempt(words, false);
  const b = attempt(words, true);
  if (a && b) return b.score > a.score ? b.draft : a.draft;
  return (a ?? b)?.draft ?? null;
}
