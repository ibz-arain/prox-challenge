import {
  readFileSync,
  readdirSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from "fs";
import { join, basename } from "path";
import type { PageData } from "../types";
import { getCreateCanvas } from "./canvas-factory";

const GENERATED_DIR = join(process.cwd(), "generated");
const IMAGES_DIR = join(GENERATED_DIR, "page-images");
const STATIC_IMAGES_DIR = join(process.cwd(), "public", "manual-pages");

export function getPageImagePath(source: string, pageNumber: number): string {
  return join(IMAGES_DIR, `${source}-page-${pageNumber}.png`);
}

export function getStaticPageImagePath(source: string, pageNumber: number): string {
  return join(STATIC_IMAGES_DIR, `${source}-p${pageNumber}.png`);
}

export function pageImageExists(source: string, pageNumber: number): boolean {
  return (
    existsSync(getStaticPageImagePath(source, pageNumber)) ||
    existsSync(getPageImagePath(source, pageNumber))
  );
}

function getCriticalPageScore(page: PageData): number {
  const text = page.text.toLowerCase();
  const keywordWeights: Record<string, number> = {
    polarity: 6,
    dcen: 6,
    dcep: 6,
    tig: 4,
    mig: 4,
    "flux-cored": 4,
    stick: 4,
    "duty cycle": 5,
    "front panel": 5,
    socket: 4,
    "wire feed": 5,
    troubleshooting: 5,
    diagnosis: 4,
    porosity: 3,
  };

  let score = 0;
  for (const [keyword, weight] of Object.entries(keywordWeights)) {
    if (text.includes(keyword)) score += weight;
  }

  if (page.contentType === "diagram") score += 4;
  if (page.contentType === "table") score += 3;
  if (page.section === "troubleshooting") score += 4;
  if (page.section === "polarity") score += 5;
  if (page.section === "specs") score += 3;

  return score;
}

export function pickCriticalPages(pages: PageData[]): Record<string, number[]> {
  const targets: Record<string, number> = {
    "owner-manual": 12,
    "quick-start-guide": 3,
  };
  const selected: Record<string, number[]> = {};

  for (const [source, limit] of Object.entries(targets)) {
    const pageNumbers = pages
      .filter((page) => page.source === source)
      .map((page) => ({
        pageNumber: page.pageNumber,
        score: getCriticalPageScore(page),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((entry) => entry.pageNumber)
      .sort((a, b) => a - b);

    if (pageNumbers.length > 0) {
      selected[source] = [...new Set(pageNumbers)];
    }
  }

  return selected;
}

async function renderPagesToDirectory(
  filesDir: string,
  outputDir: string,
  selectedPagesBySource: Record<string, number[]>,
  nameFactory: (source: string, pageNumber: number) => string
): Promise<number> {
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const createCanvasFn = await getCreateCanvas();
  if (!createCanvasFn) {
    console.log(
      "  No canvas backend available — skipping PDF-to-image rendering for this pass."
    );
    return 0;
  }

  const pdfjs = await import("pdfjs-dist");
  const files = readdirSync(filesDir).filter((f) => f.endsWith(".pdf"));
  let rendered = 0;

  for (const file of files) {
    const sourceSlug = basename(file, ".pdf");
    const selectedPages = selectedPagesBySource[sourceSlug];
    if (!selectedPages || selectedPages.length === 0) continue;

    const data = new Uint8Array(readFileSync(join(filesDir, file)));
    const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;

    for (const pageNumber of selectedPages) {
      if (pageNumber < 1 || pageNumber > doc.numPages) continue;
      const outPath = join(outputDir, nameFactory(sourceSlug, pageNumber));
      if (existsSync(outPath)) continue;

      try {
        const page = await doc.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = createCanvasFn(
          viewport.width,
          viewport.height
        ) as {
          getContext: (type: string) => CanvasRenderingContext2D;
          toBuffer: (type: string) => Buffer;
        };
        const context = canvas.getContext("2d");

        await page.render({
          canvasContext: context as unknown as CanvasRenderingContext2D,
          viewport,
        }).promise;

        writeFileSync(outPath, canvas.toBuffer("image/png"));
        rendered++;
      } catch (err) {
        console.log(
          `    Warning: failed to render ${sourceSlug} page ${pageNumber}: ${err}`
        );
      }
    }
  }

  return rendered;
}

export async function renderCriticalPageImages(
  filesDir: string,
  pages: PageData[]
): Promise<number> {
  const selectedPagesBySource = pickCriticalPages(pages);
  if (Object.keys(selectedPagesBySource).length === 0) {
    return 0;
  }

  const rendered = await renderPagesToDirectory(
    filesDir,
    STATIC_IMAGES_DIR,
    selectedPagesBySource,
    (source, pageNumber) => `${source}-p${pageNumber}.png`
  );
  console.log(`  ${rendered} static critical page images rendered`);
  return rendered;
}

export async function renderPageImages(filesDir: string): Promise<number> {
  const files = readdirSync(filesDir).filter((f) => f.endsWith(".pdf"));
  const allPagesRendered = await (async () => {
    const createCanvasFn = await getCreateCanvas();
    if (!createCanvasFn) {
      console.log(
        "  canvas backend unavailable — skipping dynamic page image rendering."
      );
      console.log("  Static pre-rendered manual pages will still be served.\n");
      return 0;
    }

    if (!existsSync(IMAGES_DIR)) {
      mkdirSync(IMAGES_DIR, { recursive: true });
    }

    const pdfjs = await import("pdfjs-dist");
    let rendered = 0;

    for (const file of files) {
      const sourceSlug = basename(file, ".pdf");
      const data = new Uint8Array(readFileSync(join(filesDir, file)));
      const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;

      console.log(`  Rendering ${file} (${doc.numPages} pages)...`);
      for (let i = 1; i <= doc.numPages; i++) {
        const outPath = getPageImagePath(sourceSlug, i);
        if (existsSync(outPath)) continue;

        try {
          const page = await doc.getPage(i);
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = createCanvasFn(
            viewport.width,
            viewport.height
          ) as {
            getContext: (type: string) => CanvasRenderingContext2D;
            toBuffer: (type: string) => Buffer;
          };
          const context = canvas.getContext("2d");

          await page.render({
            canvasContext: context as unknown as CanvasRenderingContext2D,
            viewport,
          }).promise;

          writeFileSync(outPath, canvas.toBuffer("image/png"));
          rendered++;
        } catch (err) {
          console.log(`    Warning: failed to render page ${i}: ${err}`);
        }
      }
    }

    return rendered;
  })();

  const rendered = allPagesRendered;
  console.log(`  ${rendered} page images rendered`);
  return rendered;
}
