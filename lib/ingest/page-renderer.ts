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

const FILES_DIR = join(process.cwd(), "files");
const GENERATED_DIR = join(process.cwd(), "generated");
const IMAGES_DIR = join(GENERATED_DIR, "page-images");
const STATIC_IMAGES_DIR = join(process.cwd(), "public", "manual-pages");

export function getPageImagePath(source: string, pageNumber: number): string {
  return join(IMAGES_DIR, `${source}-page-${pageNumber}.png`);
}

export function getStaticPageImagePath(source: string, pageNumber: number): string {
  return join(STATIC_IMAGES_DIR, `${source}-p${pageNumber}.png`);
}

export function getSourcePdfPath(source: string): string {
  return join(FILES_DIR, `${source}.pdf`);
}

export function pageImageExists(source: string, pageNumber: number): boolean {
  return (
    existsSync(getStaticPageImagePath(source, pageNumber)) ||
    existsSync(getPageImagePath(source, pageNumber))
  );
}

interface MatchableTextItem {
  str: string;
  width: number;
  height: number;
  transform: number[];
}

interface HighlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function normalizeForMatch(value: string): string {
  return value
    .replace(/\u00ad/g, "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s+/g, " ")
    .replace(/\.\.\.+/g, " ")
    .trim()
    .toLowerCase();
}

function splitHighlightParts(value: string): string[] {
  return value
    .split("...")
    .map((part) => normalizeForMatch(part))
    .filter((part) => part.length >= 6);
}

function overlaps(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA < endB && startB < endA;
}

function padRect(rect: HighlightRect): HighlightRect {
  return {
    x: Math.max(0, rect.x - 4),
    y: Math.max(0, rect.y - 3),
    width: rect.width + 8,
    height: rect.height + 6,
  };
}

function mergeHighlightRects(rects: HighlightRect[]): HighlightRect[] {
  const sorted = [...rects].sort((a, b) => {
    if (Math.abs(a.y - b.y) > 6) return a.y - b.y;
    return a.x - b.x;
  });
  const merged: HighlightRect[] = [];

  for (const rect of sorted) {
    const previous = merged[merged.length - 1];
    if (
      previous &&
      Math.abs(previous.y - rect.y) < 10 &&
      rect.x <= previous.x + previous.width + 18
    ) {
      const nextRight = Math.max(previous.x + previous.width, rect.x + rect.width);
      const nextBottom = Math.max(previous.y + previous.height, rect.y + rect.height);
      previous.x = Math.min(previous.x, rect.x);
      previous.y = Math.min(previous.y, rect.y);
      previous.width = nextRight - previous.x;
      previous.height = nextBottom - previous.y;
      continue;
    }
    merged.push({ ...rect });
  }

  return merged;
}

function drawHighlightRects(
  context: CanvasRenderingContext2D,
  rects: HighlightRect[]
) {
  context.save();
  context.fillStyle = "rgba(239, 99, 0, 0.18)";
  context.strokeStyle = "rgba(239, 99, 0, 0.65)";
  context.lineWidth = 2;

  for (const rect of rects) {
    if (rect.width <= 0 || rect.height <= 0) continue;
    if ("roundRect" in context && typeof context.roundRect === "function") {
      context.beginPath();
      context.roundRect(rect.x, rect.y, rect.width, rect.height, 8);
      context.fill();
      context.stroke();
    } else {
      context.fillRect(rect.x, rect.y, rect.width, rect.height);
      context.strokeRect(rect.x, rect.y, rect.width, rect.height);
    }
  }

  context.restore();
}

async function resolveHighlightRects(
  pdfjs: typeof import("pdfjs-dist/legacy/build/pdf.mjs"),
  page: {
    getTextContent: () => Promise<{ items: Array<unknown> }>;
  },
  viewport: { scale: number; transform: number[] },
  highlightText?: string
): Promise<HighlightRect[]> {
  const parts = splitHighlightParts(highlightText ?? "");
  if (parts.length === 0) return [];

  const textContent = await page.getTextContent();
  let normalizedPageText = "";
  const entries: Array<{
    start: number;
    end: number;
    item: MatchableTextItem;
  }> = [];

  for (const rawItem of textContent.items) {
    if (
      !rawItem ||
      typeof rawItem !== "object" ||
      !("str" in rawItem) ||
      !("width" in rawItem) ||
      !("height" in rawItem) ||
      !("transform" in rawItem)
    ) {
      continue;
    }
    const item = rawItem as MatchableTextItem;
    if (typeof item.str !== "string" || !item.str.trim()) continue;

    const normalized = normalizeForMatch(item.str);
    if (!normalized) continue;

    if (normalizedPageText) {
      normalizedPageText += " ";
    }
    const start = normalizedPageText.length;
    normalizedPageText += normalized;
    const end = normalizedPageText.length;

    entries.push({
      start,
      end,
      item: {
        str: item.str,
        width: item.width,
        height: item.height,
        transform: item.transform,
      },
    });
  }

  if (!normalizedPageText) return [];

  const matchedItemIndexes = new Set<number>();
  let searchOffset = 0;

  for (const part of parts) {
    const preferredMatch = normalizedPageText.indexOf(part, searchOffset);
    const matchIndex =
      preferredMatch >= 0 ? preferredMatch : normalizedPageText.indexOf(part);

    if (matchIndex < 0) {
      continue;
    }

    searchOffset = matchIndex + part.length;
    const matchEnd = matchIndex + part.length;

    entries.forEach((entry, index) => {
      if (overlaps(entry.start, entry.end, matchIndex, matchEnd)) {
        matchedItemIndexes.add(index);
      }
    });
  }

  if (matchedItemIndexes.size === 0) return [];

  const rects = [...matchedItemIndexes]
    .map((index) => {
      const entry = entries[index];
      const transformed = pdfjs.Util.transform(viewport.transform, entry.item.transform);
      const x = transformed[4];
      const estimatedHeight = Math.max(
        Math.abs(transformed[3]),
        entry.item.height * viewport.scale,
        12
      );
      const width = Math.max(entry.item.width * viewport.scale, 10);
      const y = transformed[5] - estimatedHeight;

      return padRect({ x, y, width, height: estimatedHeight });
    })
    .filter((rect) => Number.isFinite(rect.x) && Number.isFinite(rect.y));

  return mergeHighlightRects(rects);
}

export async function renderPageToPng(
  source: string,
  pageNumber: number,
  options?: { highlightText?: string }
): Promise<Buffer | null> {
  const pdfPath = getSourcePdfPath(source);
  if (!existsSync(pdfPath)) {
    return null;
  }

  const createCanvasFn = await getCreateCanvas();
  if (!createCanvasFn) {
    return null;
  }

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(readFileSync(pdfPath));
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;

  if (pageNumber < 1 || pageNumber > doc.numPages) {
    return null;
  }

  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1.5 });
  const canvas = createCanvasFn(viewport.width, viewport.height) as {
    getContext: (type: string) => CanvasRenderingContext2D;
    toBuffer: (type: string) => Buffer;
  };
  const context = canvas.getContext("2d");

  await page.render({
    canvasContext: context as unknown as CanvasRenderingContext2D,
    viewport,
  }).promise;

  const rects = await resolveHighlightRects(pdfjs, page, viewport, options?.highlightText);
  if (rects.length > 0) {
    drawHighlightRects(context, rects);
  }

  return canvas.toBuffer("image/png");
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

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
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

    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
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
