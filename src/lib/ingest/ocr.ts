import type { Worker } from 'tesseract.js';

let workerPromise: Promise<Worker> | null = null;
let progressCb: ((p: number) => void) | undefined;

/** Lazily start one OCR worker (English + Hindi), served from /tesseract so it works offline. */
async function getWorker(onProgress?: (p: number) => void): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker, OEM } = await import('tesseract.js');
      const base = import.meta.env.BASE_URL;
      return createWorker(['eng', 'hin'], OEM.LSTM_ONLY, {
        workerPath: `${base}tesseract/worker.min.js`,
        corePath: `${base}tesseract/`,
        langPath: `${base}tesseract/lang`,
        gzip: true,
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text') progressCb?.(m.progress);
        },
      });
    })();
  }
  progressCb = onProgress;
  return workerPromise;
}

export async function ocrImage(image: Blob | HTMLCanvasElement, onProgress?: (p: number) => void): Promise<string> {
  const worker = await getWorker(onProgress);
  const { data } = await worker.recognize(image);
  return data.text;
}
