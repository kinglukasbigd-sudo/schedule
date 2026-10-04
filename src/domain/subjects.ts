import { fold } from '@/lib/text';
import { hueOfPreset, pickHue, presetOf } from '@/logic/subjects';
import type { Subject, SubjectColor } from './types';

/** The pastel a new subject gets: the v2 rule (DESIGN §2.3) shown as its preset name. */
export function pickColor(existing: Pick<Subject, 'color'>[]): SubjectColor {
  return presetOf(pickHue(existing.map((s) => hueOfPreset(s.color))));
}

/**
 * Colours for every subject name in a draft: existing subjects keep theirs, new names get the
 * next free pastel in order of first appearance. Used for the editor preview and when saving,
 * so what you see is what you get.
 */
export function assignColors(names: string[], existing: Pick<Subject, 'name' | 'color'>[]): Map<string, SubjectColor> {
  const result = new Map<string, SubjectColor>();
  const hues = existing.map((s) => hueOfPreset(s.color));
  for (const s of existing) result.set(fold(s.name), s.color);
  for (const name of names) {
    const key = fold(name);
    if (result.has(key)) continue;
    const hue = pickHue(hues);
    hues.push(hue);
    result.set(key, presetOf(hue));
  }
  return result;
}
