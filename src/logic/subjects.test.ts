import { describe, expect, it } from 'vitest';
import { HUE_PRESETS, circularDistance, findSubjectByName, hueOfPreset, pickHue, presetOf, sameSubjectName } from './subjects';

describe('subject hues', () => {
  it('maps v1 colour names to preset hues and back', () => {
    for (const p of HUE_PRESETS) {
      expect(hueOfPreset(p.name)).toBe(p.hue);
      expect(presetOf(p.hue)).toBe(p.name);
    }
    expect(hueOfPreset('stone')).toBeNull();
    expect(hueOfPreset('unknown')).toBeNull();
    expect(presetOf(null)).toBe('stone');
  });

  it('snaps custom hues to the nearest preset, across 0°', () => {
    expect(presetOf(359)).toBe('rose');
    expect(presetOf(350)).toBe('rose');
    expect(presetOf(20)).toBe('rose'); // equidistant from rose (5) and coral (35): earlier wins
    expect(presetOf(21)).toBe('coral');
  });

  it('measures circular distance', () => {
    expect(circularDistance(5, 355)).toBe(10);
    expect(circularDistance(355, 5)).toBe(10);
    expect(circularDistance(0, 180)).toBe(180);
    expect(circularDistance(-10, 10)).toBe(20);
  });

  it('assigns unused presets first, in preset order', () => {
    expect(pickHue([])).toBe(5);
    expect(pickHue([5, null])).toBe(35);
    expect(pickHue([35, 5])).toBe(75);
    expect(pickHue([5, 5, 35])).toBe(75);
    // A custom hue near a preset doesn't count as using it.
    expect(pickHue([6])).toBe(5);
  });

  it('after all ten presets, takes the hue farthest from every existing one', () => {
    const all = HUE_PRESETS.map((p) => p.hue);
    const next = pickHue(all);
    const gap = Math.min(...all.map((h) => circularDistance(next, h)));
    for (let h = 0; h < 360; h++) expect(Math.min(...all.map((x) => circularDistance(h, x)))).toBeLessThanOrEqual(gap);
    // Ties go to the lowest hue: the widest gaps (35°) are 75–125 and 190–235; 100 is the lowest best.
    expect(next).toBe(100);
    expect(pickHue([...all, next])).not.toBe(next);
  });

  it('compares names ignoring case and diacritics', () => {
    expect(sameSubjectName('Französisch', ' franzosisch ')).toBe(true);
    expect(sameSubjectName('Mathe', 'Math')).toBe(false);
    expect(findSubjectByName([{ name: 'Biology' }, { name: 'Математика' }], 'математика')?.name).toBe('Математика');
    expect(findSubjectByName([{ name: 'Biology' }], 'Bio')).toBeUndefined();
  });
});
