import type { WordBox } from './layout';

export type OcrLanguage = 'eng' | 'deu' | 'mkd';

/** Scale images into the range Tesseract reads best (text ≈ 20–40 px high). */
async function prepare(image: Blob | HTMLCanvasElement): Promise<HTMLCanvasElement> {
  if (image instanceof HTMLCanvasElement) return image;
  const bitmap = await createImageBitmap(image);
  const longest = Math.max(bitmap.width, bitmap.height);
  const scale = longest < 1400 ? 2 : longest > 3200 ? 3200 / longest : 1;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas-unavailable');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

/**
 * On-device OCR with Tesseract (lazy-loaded). The engine ships with the app; language data
 * is fetched once from the jsDelivr CDN and then cached in IndexedDB by Tesseract.
 */
export async function recognizeWords(
  image: Blob | HTMLCanvasElement,
  languages: OcrLanguage[],
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<WordBox[]> {
  const [{ createWorker, OEM, PSM }, workerPath, corePath] = await Promise.all([
    import('tesseract.js'),
    import('tesseract.js/dist/worker.min.js?url').then((m) => m.default),
    import('tesseract.js-core/tesseract-core-simd-lstm.wasm.js?url').then((m) => m.default),
  ]);
  const canvas = await prepare(image);
  signal?.throwIfAborted();

  const worker = await createWorker(languages, OEM.LSTM_ONLY, {
    workerPath,
    corePath,
    logger: (m) => {
      if (m.status === 'recognizing text') onProgress(m.progress);
    },
  });
  const abort = () => void worker.terminate();
  signal?.addEventListener('abort', abort, { once: true });
  try {
    // Timetables are ruled grids: the default automatic segmentation reads the boxed cells as
    // pictures and returns noise. Sparse-text mode finds every word wherever it is, and the
    // layout parser rebuilds the grid from word positions anyway.
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
    const { data } = await worker.recognize(canvas, {}, { blocks: true });
    signal?.throwIfAborted();
    const words: WordBox[] = [];
    for (const block of data.blocks ?? []) {
      for (const para of block.paragraphs) {
        for (const line of para.lines) {
          for (const w of line.words) {
            if (w.confidence < 30 || !w.text.trim()) continue;
            words.push({ text: w.text, x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1 });
          }
        }
      }
    }
    return words;
  } finally {
    signal?.removeEventListener('abort', abort);
    await worker.terminate().catch(() => undefined);
  }
}
