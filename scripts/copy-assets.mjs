// Copies OCR engine + language data into public/ so Sahaj works fully offline.
import { cpSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const nm = join(root, 'node_modules');
const out = join(root, 'public', 'tesseract');
mkdirSync(join(out, 'lang'), { recursive: true });

const copies = [
  ['tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm.js'],
  ['tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'],
  ['tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js'],
  ['@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', 'lang/eng.traineddata.gz'],
  ['@tesseract.js-data/hin/4.0.0_best_int/hin.traineddata.gz', 'lang/hin.traineddata.gz'],
];
for (const [from, to] of copies) {
  const src = join(nm, from);
  if (!existsSync(src)) { console.warn('missing', from); continue; }
  cpSync(src, join(out, to));
}
console.log('OCR assets copied to public/tesseract');
