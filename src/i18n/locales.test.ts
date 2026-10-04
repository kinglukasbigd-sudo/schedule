import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import de from './locales/de.json';
import en from './locales/en.json';
import mk from './locales/mk.json';

function flatten(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? flatten(v as object, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

const keys = { en: flatten(en).sort(), mk: flatten(mk).sort(), de: flatten(de).sort() };

describe('locales', () => {
  it('Macedonian and German have exactly the English keys', () => {
    expect(keys.mk).toEqual(keys.en);
    expect(keys.de).toEqual(keys.en);
  });

  it('has no empty strings', () => {
    for (const [lang, dict] of Object.entries({ en, mk, de })) {
      const empty = flatten(dict).filter((k) => {
        const v = k.split('.').reduce<unknown>((o, p) => (o as Record<string, unknown>)[p], dict);
        return typeof v !== 'string' || !v.trim();
      });
      expect(empty, lang).toEqual([]);
    }
  });

  it('every literal key used in the code exists', () => {
    const src = resolve(__dirname, '..');
    const walk = (d: string): string[] =>
      readdirSync(d).flatMap((n) => {
        const p = join(d, n);
        return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(n) && !n.includes('.test.') ? [p] : [];
      });
    const known = new Set(keys.en.map((k) => k.replace(/_(one|other)$/, '')));
    const prefixes = new Set(keys.en.map((k) => k.split('.').slice(0, -1).join('.')));
    const missing: string[] = [];
    for (const file of walk(src)) {
      const code = readFileSync(file, 'utf8');
      for (const m of code.matchAll(/\bt\(\s*'([a-zA-Z]+\.[\w.-]+)'/g)) {
        if (!known.has(m[1] as string)) missing.push(`${file}: ${m[1]}`);
      }
      for (const m of code.matchAll(/\bt\(\s*`([a-zA-Z.]+)\.\$\{/g)) {
        if (!prefixes.has(m[1] as string)) missing.push(`${file}: ${m[1]}.*`);
      }
    }
    expect(missing).toEqual([]);
  });
});
