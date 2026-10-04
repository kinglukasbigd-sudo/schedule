import { fold } from '@/lib/text';
import type { Subject } from './types';

/** DESIGN §2.3 presets, in assignment order. `stone` is neutral (hue null) and never auto-assigned. */
export const HUE_PRESETS = [
  { name: 'rose', hue: 5 },
  { name: 'coral', hue: 35 },
  { name: 'amber', hue: 75 },
  { name: 'lime', hue: 125 },
  { name: 'mint', hue: 160 },
  { name: 'teal', hue: 190 },
  { name: 'sky', hue: 235 },
  { name: 'iris', hue: 270 },
  { name: 'lilac', hue: 300 },
  { name: 'orchid', hue: 335 },
] as const;

export type PresetName = (typeof HUE_PRESETS)[number]['name'] | 'stone';

/** v1 colour names map 1:1 onto presets (SPEC §9.2). */
export function hueOfPreset(name: string): number | null {
  return HUE_PRESETS.find((p) => p.name === name)?.hue ?? null;
}

export function circularDistance(a: number, b: number): number {
  const d = Math.abs((((a - b) % 360) + 360) % 360);
  return Math.min(d, 360 - d);
}

/** The preset a hue is closest to (ties → earlier preset); `stone` for neutral. */
export function presetOf(hue: number | null): PresetName {
  if (hue == null) return 'stone';
  let best: PresetName = HUE_PRESETS[0].name;
  let bestDistance = Infinity;
  for (const p of HUE_PRESETS) {
    const d = circularDistance(hue, p.hue);
    if (d < bestDistance) {
      best = p.name;
      bestDistance = d;
    }
  }
  return best;
}

/**
 * Hue for a new subject (DESIGN §2.3): the first preset nobody uses yet; once all ten are taken,
 * the integer hue farthest from every existing hue (ties → lowest hue).
 */
export function pickHue(existing: readonly (number | null)[]): number {
  const used = existing.filter((h): h is number => h != null);
  const free = HUE_PRESETS.find((p) => !used.includes(p.hue));
  if (free) return free.hue;
  let best = 0;
  let bestDistance = -1;
  for (let h = 0; h < 360; h++) {
    const d = Math.min(...used.map((u) => circularDistance(h, u)));
    if (d > bestDistance) {
      best = h;
      bestDistance = d;
    }
  }
  return best;
}

/** Subjects are unique by name ignoring case and diacritics ("Französisch" = "franzosisch"). */
export function sameSubjectName(a: string, b: string): boolean {
  return fold(a.trim()) === fold(b.trim());
}

export function findSubjectByName<S extends Pick<Subject, 'name'>>(subjects: readonly S[], name: string): S | undefined {
  return subjects.find((s) => sameSubjectName(s.name, name));
}
