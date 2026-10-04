import { fold } from '@/lib/text';
import { SUBJECT_COLORS, type Subject, type SubjectColor } from './types';

/** Pick the least-used pastel so neighbouring subjects rarely share a colour. */
export function pickColor(existing: Pick<Subject, 'color'>[]): SubjectColor {
  const counts = new Map<SubjectColor, number>(SUBJECT_COLORS.map((c) => [c, 0]));
  for (const s of existing) counts.set(s.color, (counts.get(s.color) ?? 0) + 1);
  let best: SubjectColor = SUBJECT_COLORS[0];
  for (const c of SUBJECT_COLORS) if ((counts.get(c) ?? 0) < (counts.get(best) ?? 0)) best = c;
  return best;
}

/**
 * Colours for every subject name in a draft: existing subjects keep theirs, new names get the
 * least-used pastel in order of first appearance. Used for the editor preview and when saving,
 * so what you see is what you get.
 */
export function assignColors(names: string[], existing: Pick<Subject, 'name' | 'color'>[]): Map<string, SubjectColor> {
  const result = new Map<string, SubjectColor>();
  const used: Pick<Subject, 'color'>[] = [...existing];
  for (const s of existing) result.set(fold(s.name), s.color);
  for (const name of names) {
    const key = fold(name);
    if (result.has(key)) continue;
    const color = pickColor(used);
    used.push({ color });
    result.set(key, color);
  }
  return result;
}
