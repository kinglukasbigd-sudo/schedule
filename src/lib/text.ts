/** Lowercase and strip diacritics so "Prüfung" ≈ "prufung" and "ќ" ≈ "к". */
export function fold(input: string): string {
  return input.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase();
}

/** Split into letter/number tokens, Unicode aware (works for Cyrillic). */
export function tokens(input: string): string[] {
  return fold(input)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** Levenshtein distance, bounded for speed. */
export function editDistance(a: string, b: string, max = Infinity): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const v = Math.min((prev[j] ?? 0) + 1, (cur[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
      cur.push(v);
      rowMin = Math.min(rowMin, v);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length] ?? 0;
}

/** Title-case the first letter only ("math" → "Math"), leaving the rest as typed. */
export function capitalize(input: string): string {
  const s = input.trim();
  return s.charAt(0).toLocaleUpperCase() + s.slice(1);
}

/** Conventional short forms for common subjects (EN / DE / MK), keyed by folded name. */
const SHORT_FORMS: Record<string, string> = {
  mathematics: 'Math', english: 'Eng', german: 'Ger', french: 'Fre', spanish: 'Spa', italian: 'Ita',
  biology: 'Bio', chemistry: 'Chem', physics: 'Phys', history: 'Hist', geography: 'Geo',
  religion: 'RE', economics: 'Econ', informatics: 'IT', computing: 'IT', technology: 'Tech',
  literature: 'Lit', philosophy: 'Phil', psychology: 'Psych', sociology: 'Soc', science: 'Sci',
  macedonian: 'Mac', citizenship: 'Cit',
  mathematik: 'Mathe', deutsch: 'Deu', englisch: 'Eng', franzosisch: 'Frz', spanisch: 'Spa', latein: 'Lat',
  biologie: 'Bio', chemie: 'Chem', physik: 'Phy', geschichte: 'Gesch', geographie: 'Geo', erdkunde: 'Ek',
  informatik: 'Info', sozialkunde: 'Sozi', wirtschaft: 'Wirt', religionslehre: 'Rel',
  математика: 'Мат', македонски: 'Мак', англиски: 'Анг', германски: 'Гер', француски: 'Фра',
  биологија: 'Био', хемија: 'Хем', физика: 'Физ', историја: 'Ист', географија: 'Гео', музичко: 'Муз',
  ликовно: 'Лик', информатика: 'Инф', физичко: 'ФЗО', филозофија: 'Фил', социологија: 'Соц',
  психологија: 'Пси', латински: 'Лат', техничко: 'Тех', граѓанско: 'Грѓ',
};

/** Connector words skipped when building initials ("Physical and Health Education" → "PHE"). */
const CONNECTORS = new Set(['and', 'of', 'the', 'und', 'für', 'и', 'за', '&', '+']);

/**
 * Short label for dense grids (about five characters fit a phone-width column):
 * known subjects use their usual short form, multi-word names their initials,
 * short names stay whole, anything else is cut to four letters.
 */
export function abbreviate(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 1 && (words[0] ?? '').length <= 5) return words[0] ?? '';
  const known = SHORT_FORMS[fold(name.trim())];
  if (known) return known;
  if (words.length > 1) {
    const first = SHORT_FORMS[fold(words[0] ?? '')];
    const initials = words
      .filter((w) => !CONNECTORS.has(w.toLocaleLowerCase()))
      .slice(0, 3)
      .map((w) => w.charAt(0).toLocaleUpperCase())
      .join('');
    // "Mathematics 2" → "Math 2"
    if (first && /^\d+$/.test(words[words.length - 1] ?? '')) return `${first} ${words[words.length - 1]}`;
    return initials;
  }
  const word = words[0] ?? '';
  return word.slice(0, 4);
}
