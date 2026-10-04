import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import config from '../../tailwind.config';

const SRC = resolve(__dirname, '..');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name: string) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return files(p);
    return /\.(tsx?|css)$/.test(name) && !/\.test\.tsx?$/.test(name) && !p.includes('/test/') ? [p] : [];
  });
}

const sources = files(SRC).filter((f) => !f.endsWith('tokens.css'));

describe('design token discipline', () => {
  it('uses no Tailwind arbitrary values (w-[13px], bg-[#fff]…)', () => {
    const offenders = sources.flatMap((f) =>
      [...readFileSync(f, 'utf8').matchAll(/\b[a-z][a-z0-9:-]*-\[[^\]\s]+\]/g)].map((m) => `${f}: ${m[0]}`),
    );
    expect(offenders).toEqual([]);
  });

  it('uses no raw hex colours outside tokens.css', () => {
    const offenders = sources.flatMap((f) =>
      [...readFileSync(f, 'utf8').matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![\w-])/g)].map((m) => `${f}: ${m[0]}`),
    );
    expect(offenders).toEqual([]);
  });

  it('keeps every spacing token on the 4px grid', () => {
    const spacing = config.theme.spacing as Record<string, string>;
    for (const [key, value] of Object.entries(spacing)) {
      if (key === 'px') continue;
      expect(Number.parseFloat(value) % 4, `${key} = ${value}`).toBe(0);
    }
  });

  it('keeps every line height and radius on the 4px grid', () => {
    for (const [, [, { lineHeight }]] of Object.entries(config.theme.fontSize as Record<string, [string, { lineHeight: string }]>)) {
      expect(Number.parseFloat(lineHeight) % 4).toBe(0);
    }
    for (const [key, value] of Object.entries(config.theme.borderRadius as Record<string, string>)) {
      if (['none', 'full'].includes(key)) continue;
      expect(Number.parseFloat(value) % 4, key).toBe(0);
    }
  });
});
