import { join } from "path";
import { pathToFileURL } from "url";

type LegacyPdfjs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

/**
 * PDF.js on Node uses a "fake worker" that dynamic-imports the worker script.
 * Next/Vercel output tracing often omits `pdf.worker.mjs`, which breaks serverless.
 * `next.config` should list those files in `outputFileTracingIncludes`; this sets an
 * absolute `file:` URL so resolution matches the traced path under `node_modules`.
 */
export function configureLegacyPdfjsWorker(pdfjs: LegacyPdfjs): void {
  const workerPath = join(
    process.cwd(),
    "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"
  );
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;
}
