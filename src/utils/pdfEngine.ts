import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';

// Configure PDF.js worker using Vite's asset URL resolution
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export type ImageFormat = 'png' | 'jpeg' | 'webp';
export type ExportScale = 1 | 2 | 3;
export type DownloadMode = 'zip' | 'separate';

export interface PdfPageItem {
  pageNumber: number;
  thumbnailUrl: string;
  width: number;
  height: number;
  rotation: number; // 0, 90, 180, 270
  selected: boolean;
}

export interface ExportOptions {
  format: ImageFormat;
  scale: ExportScale;
  quality: number; // 0.1 to 1.0
  filePrefix: string;
  downloadMode: DownloadMode;
}

const MAX_CONCURRENCY =
  typeof navigator !== 'undefined' && navigator.hardwareConcurrency
    ? Math.min(6, Math.max(2, Math.floor(navigator.hardwareConcurrency / 2)))
    : 4;

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export async function loadPdfDocument(file: File | Blob): Promise<pdfjsLib.PDFDocumentProxy> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  return await loadingTask.promise;
}

export async function renderPageThumbnail(
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  pageNumber: number,
  maxWidth = 380
): Promise<{ thumbnailUrl: string; width: number; height: number }> {
  const page = await pdfDoc.getPage(pageNumber);
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = Math.min(maxWidth / baseViewport.width, 1.35);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Could not initialize canvas context');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({
    canvasContext: ctx,
    viewport,
    canvas,
  }).promise;

  const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.8);
  // Release canvas memory immediately
  canvas.width = 0;
  canvas.height = 0;

  return {
    thumbnailUrl,
    width: Math.round(baseViewport.width),
    height: Math.round(baseViewport.height),
  };
}

export async function renderPageToBlob(
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  pageNumber: number,
  options: { format: ImageFormat; scale: ExportScale; quality: number; rotation: number }
): Promise<{ blob: Blob; width: number; height: number }> {
  const page = await pdfDoc.getPage(pageNumber);
  const viewport = page.getViewport({
    scale: options.scale,
    rotation: (page.rotate + options.rotation) % 360,
  });

  const width = Math.floor(viewport.width);
  const height = Math.floor(viewport.height);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Could not initialize canvas context');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  await page.render({
    canvasContext: ctx,
    viewport,
    canvas,
  }).promise;

  const mimeType = `image/${options.format}`;
  const quality = options.format === 'png' ? undefined : options.quality;

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Failed to encode image'))),
      mimeType,
      quality
    );
  });

  // Free canvas buffer immediately for faster GC on large PDFs
  canvas.width = 0;
  canvas.height = 0;

  return { blob, width, height };
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Parallel batch exporter supporting both fast uncompressed-STORE ZIP
 * and individual staggered file downloads.
 */
export async function exportPages(
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  pages: PdfPageItem[],
  options: ExportOptions,
  onProgress?: (completed: number, total: number) => void
): Promise<void> {
  const ext = options.format === 'jpeg' ? 'jpg' : options.format;
  const cleanPrefix =
    options.filePrefix.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_') || 'document';
  const padLength = String(pdfDoc.numPages).length;

  // Single page: always direct download
  if (pages.length === 1) {
    const p = pages[0];
    const { blob } = await renderPageToBlob(pdfDoc, p.pageNumber, {
      format: options.format,
      scale: options.scale,
      quality: options.quality,
      rotation: p.rotation,
    });
    onProgress?.(1, 1);
    triggerDownload(blob, `${cleanPrefix}_page_${p.pageNumber}.${ext}`);
    return;
  }

  // Render pages in parallel worker pool for maximum throughput
  const results: { filename: string; blob: Blob }[] = new Array(pages.length);
  let nextIndex = 0;
  let completed = 0;

  const worker = async () => {
    while (nextIndex < pages.length) {
      const idx = nextIndex++;
      const p = pages[idx];
      const { blob } = await renderPageToBlob(pdfDoc, p.pageNumber, {
        format: options.format,
        scale: options.scale,
        quality: options.quality,
        rotation: p.rotation,
      });
      const padded = String(p.pageNumber).padStart(padLength, '0');
      results[idx] = {
        filename: `${cleanPrefix}_page_${padded}.${ext}`,
        blob,
      };
      completed++;
      onProgress?.(completed, pages.length);
    }
  };

  const workers = Array.from({ length: Math.min(MAX_CONCURRENCY, pages.length) }, () => worker());
  await Promise.all(workers);

  if (options.downloadMode === 'separate') {
    // Stagger individual downloads slightly so browsers don't block rapid triggers
    for (let i = 0; i < results.length; i++) {
      triggerDownload(results[i].blob, results[i].filename);
      if (i < results.length - 1) {
        await new Promise((r) => setTimeout(r, 120));
      }
    }
    return;
  }

  // Use STORE (no re-compression) since PNG/JPG/WebP are already compressed -> instant ZIP
  const zip = new JSZip();
  for (const item of results) {
    zip.file(item.filename, item.blob);
  }
  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'STORE',
  });
  triggerDownload(zipBlob, `${cleanPrefix}_images.zip`);
}
