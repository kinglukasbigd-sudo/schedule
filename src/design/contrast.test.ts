import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ACCENTS, SUBJECT_COLORS } from '@/domain/types';

/** Parse `selector { --name: r g b; }` blocks from tokens.css into RGB triples. */
function parseTokens(css: string): Map<string, Record<string, [number, number, number]>> {
  const blocks = new Map<string, Record<string, [number, number, number]>>();
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of clean.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const selectors = (m[1] as string).split(',').map((s) => s.trim().replace(/"/g, "'"));
    const vars: Record<string, [number, number, number]> = {};
    for (const v of (m[2] as string).matchAll(/--([\w-]+):\s*(\d+)\s+(\d+)\s+(\d+)\s*;/g)) {
      vars[v[1] as string] = [Number(v[2]), Number(v[3]), Number(v[4])];
    }
    for (const sel of selectors) blocks.set(sel, { ...(blocks.get(sel) ?? {}), ...vars });
  }
  return blocks;
}

function luminance([r, g, b]: [number, number, number]): number {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrast(a: [number, number, number], b: [number, number, number]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const css = readFileSync(resolve(__dirname, 'tokens.css'), 'utf8');
const blocks = parseTokens(css);
const themes = {
  light: blocks.get("[data-theme='light']") ?? {},
  dark: blocks.get("[data-theme='dark']") ?? {},
};

const TEXT_ON = {
  ink: ['bg', 'surface', 'surface-2', 'surface-3', 'danger-soft'],
  'ink-2': ['bg', 'surface', 'surface-2', 'surface-3'],
  'ink-3': ['bg', 'surface', 'surface-2'],
  danger: ['bg', 'surface', 'surface-2'],
  bg: ['ink'],
} as const;

describe.each(Object.entries(themes))('%s theme', (_name, vars) => {
  const get = (k: string) => {
    const v = vars[k];
    if (!v) throw new Error(`missing --${k}`);
    return v;
  };

  for (const [fg, bgs] of Object.entries(TEXT_ON)) {
    for (const bg of bgs) {
      it(`${fg} on ${bg} meets AA (4.5:1)`, () => {
        expect(contrast(get(fg), get(bg))).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it('line-strong (input & checkbox outlines) meets 3:1 on surfaces', () => {
    for (const bg of ['bg', 'surface', 'surface-2']) expect(contrast(get('line-strong'), get(bg))).toBeGreaterThanOrEqual(3);
  });

  it.each(SUBJECT_COLORS)('subject %s text meets AA on its pastel', (c) => {
    expect(contrast(get(`${c}-fg`), get(`${c}-bg`))).toBeGreaterThanOrEqual(4.5);
  });
});

describe.each(ACCENTS)('accent %s', (accent) => {
  for (const [theme, base] of Object.entries(themes)) {
    const sel = theme === 'light' ? `[data-accent='${accent}']` : `[data-theme='dark'][data-accent='${accent}']`;
    const a = blocks.get(sel) ?? {};
    const vars = { ...base, ...a };
    const get = (k: string) => {
      const v = vars[k];
      if (!v) throw new Error(`missing --${k} for ${sel}`);
      return v;
    };
    it(`${theme}: label on fill, accent text on surfaces and tint all meet AA`, () => {
      expect(contrast(get('accent-fg'), get('accent'))).toBeGreaterThanOrEqual(4.5);
      for (const bg of ['bg', 'surface', 'accent-soft']) expect(contrast(get('accent'), get(bg))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(get('ink'), get('accent-soft'))).toBeGreaterThanOrEqual(4.5);
    });
  }
});

describe('token coverage', () => {
  it('defines every subject class', () => {
    for (const c of SUBJECT_COLORS) expect(css).toContain(`.subject-${c} {`);
  });
});
