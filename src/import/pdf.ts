import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import type { WordBox } from './layout';

/** Read the text layer of the first PDF page as positioned runs. Lazy-loads pdf.js. */
export async function readPdf(file: Blob): Promise<{ words: WordBox[]; render: () => Promise<HTMLCanvasElement> }> {
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();

  const words: WordBox[] = [];
  for (const item of content.items) {
    if (!('str' in item)) continue;
    const t = item as TextItem;
    // Runs with wide internal gaps are separate cells that pdf.js merged.
    const parts = t.str.split(/\s{3,}/).filter((p) => p.trim());
    if (parts.length === 0) continue;
    const [, , , , e, f] = t.transform as number[];
    const height = t.height || Math.abs((t.transform as number[])[3] ?? 10);
    const [x0, yTop] = viewport.convertToViewportPoint(e ?? 0, (f ?? 0) + height) as [number, number];
    const [x1, yBottom] = viewport.convertToViewportPoint((e ?? 0) + t.width, f ?? 0) as [number, number];
    const total = t.str.length || 1;
    let offset = 0;
    for (const part of parts) {
      const start = t.str.indexOf(part, offset);
      offset = start + part.length;
      const px0 = x0 + ((x1 - x0) * start) / total;
      const px1 = x0 + ((x1 - x0) * offset) / total;
      words.push({ text: part.trim(), x0: px0, y0: Math.min(yTop, yBottom), x1: px1, y1: Math.max(yTop, yBottom) });
    }
  }

  const render = async () => {
    const scaled = page.getViewport({ scale: 2.5 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(scaled.width);
    canvas.height = Math.ceil(scaled.height);
    await page.render({ canvas, viewport: scaled }).promise;
    return canvas;
  };
  return { words, render };
}
