import type { DraftTimetable, Language } from '@/domain/types';
import { parseLayout, type WordBox } from './layout';
import type { OcrLanguage } from './ocr';
import { parseTimetableText } from './text';

export type ImportPhase = 'reading' | 'recognizing' | 'arranging';

export class ImportError extends Error {
  constructor(public readonly code: 'unsupported' | 'no-timetable' | 'failed') {
    super(code);
    this.name = 'ImportError';
  }
}

const OCR_LANGUAGES: Record<Language, OcrLanguage[]> = {
  en: ['eng'],
  de: ['deu', 'eng'],
  mk: ['mkd', 'eng'],
};

export function isSupportedFile(file: File): boolean {
  return file.type === 'application/pdf' || file.type.startsWith('image/') || /\.(pdf|png|jpe?g|webp|heic)$/i.test(file.name);
}

/** Rebuild plain text lines from positioned words, as a last-resort input for the text parser. */
function wordsToText(words: WordBox[]): string {
  const height = words.map((w) => w.y1 - w.y0).sort((a, b) => a - b)[Math.floor(words.length / 2)] ?? 10;
  const sorted = [...words].sort((a, b) => a.y0 - b.y0);
  const lines: WordBox[][] = [];
  for (const w of sorted) {
    const line = lines[lines.length - 1];
    const cy = (w.y0 + w.y1) / 2;
    if (line && Math.abs((line[0] as WordBox).y0 + (line[0] as WordBox).y1 - 2 * cy) / 2 < height * 0.6) line.push(w);
    else lines.push([w]);
  }
  return lines
    .map((l) =>
      l
        .sort((a, b) => a.x0 - b.x0)
        .reduce((acc, w, i, arr) => {
          const prev = arr[i - 1];
          const gap = prev ? w.x0 - prev.x1 : 0;
          return acc + (i === 0 ? '' : gap > height * 1.5 ? '\t' : ' ') + w.text;
        }, ''),
    )
    .join('\n');
}

export function wordsToDraft(words: WordBox[]): DraftTimetable | null {
  return parseLayout(words) ?? parseTimetableText(wordsToText(words));
}

/**
 * Photo, screenshot or PDF → draft timetable, entirely on-device.
 * PDFs use their text layer when present and fall back to OCR for scanned pages.
 */
export async function importTimetableFile(
  file: File,
  language: Language,
  onProgress: (phase: ImportPhase, fraction: number) => void,
  signal?: AbortSignal,
): Promise<DraftTimetable> {
  if (!isSupportedFile(file)) throw new ImportError('unsupported');
  onProgress('reading', 0);
  let words: WordBox[] = [];
  let source: Blob | HTMLCanvasElement = file;

  try {
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
      const { readPdf } = await import('./pdf');
      const pdf = await readPdf(file);
      signal?.throwIfAborted();
      words = pdf.words;
      if (words.length < 6) source = await pdf.render();
    }
    if (words.length < 6) {
      const { recognizeWords } = await import('./ocr');
      onProgress('recognizing', 0);
      words = await recognizeWords(source, OCR_LANGUAGES[language], (f) => onProgress('recognizing', f), signal);
    }
  } catch (err) {
    if (signal?.aborted) throw err;
    console.error('[import]', err);
    throw new ImportError('failed');
  }

  signal?.throwIfAborted();
  onProgress('arranging', 1);
  const draft = wordsToDraft(words);
  if (!draft || draft.cells.length < 2) throw new ImportError('no-timetable');
  return draft;
}
