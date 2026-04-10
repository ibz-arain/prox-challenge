import { readFileSync, readdirSync } from "fs";
import { join, basename } from "path";
import type { PageData } from "../types";
import { getCreateCanvas } from "./canvas-factory";
import { extractPageTextWithVision } from "./vision-extractor";
import { configureLegacyPdfjsWorker } from "./pdfjs-server";

let pdfjsLib: typeof import("pdfjs-dist/legacy/build/pdf.mjs") | null = null;

async function getPdfjs() {
  if (!pdfjsLib) {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    configureLegacyPdfjsWorker(pdfjs);
    pdfjsLib = pdfjs;
  }
  return pdfjsLib;
}

function detectSection(text: string, pageNum: number): string {
  const lower = text.toLowerCase();
  if (
    lower.includes("safety") ||
    lower.includes("warning") ||
    lower.includes("danger")
  )
    return "safety";
  if (
    lower.includes("troubleshoot") ||
    lower.includes("problem") ||
    lower.includes("diagnosis")
  )
    return "troubleshooting";
  if (
    lower.includes("duty cycle") ||
    lower.includes("specification") ||
    lower.includes("rated")
  )
    return "specs";
  if (
    lower.includes("setup") ||
    lower.includes("install") ||
    lower.includes("connect") ||
    lower.includes("assemble")
  )
    return "setup";
  if (
    lower.includes("polarity") ||
    lower.includes("dcen") ||
    lower.includes("dcep")
  )
    return "polarity";
  if (lower.includes("parts list") || lower.includes("part no"))
    return "parts";
  if (
    lower.includes("mig") ||
    lower.includes("tig") ||
    lower.includes("stick") ||
    lower.includes("flux")
  )
    return "welding-process";
  if (
    lower.includes("maintenance") ||
    lower.includes("clean") ||
    lower.includes("inspect")
  )
    return "maintenance";
  if (pageNum <= 3) return "introduction";
  return "general";
}

function detectContentType(
  text: string
): "text" | "table" | "diagram" | "mixed" {
  const lines = text.split("\n").filter((l) => l.trim());
  const hasTabularPatterns =
    lines.filter(
      (l) =>
        (l.includes("\t") || l.match(/\s{3,}/)) &&
        (l.match(/\d+/) || l.includes("%"))
    ).length > 3;
  const hasShortLines =
    lines.filter((l) => l.trim().length < 30).length > lines.length * 0.6;
  const hasFewWords = text.split(/\s+/).length < 50;

  if (hasTabularPatterns) return "table";
  if (hasShortLines && hasFewWords) return "diagram";
  if (hasTabularPatterns && !hasFewWords) return "mixed";
  return "text";
}

export async function parsePdfFile(
  filePath: string
): Promise<{
  pages: Omit<PageData, "id">[];
  totalPages: number;
  textExtractedPages: number;
  visionExtractedPages: number;
  visionFailedPages: number;
}> {
  const pdfjs = await getPdfjs();
  const data = new Uint8Array(readFileSync(filePath));
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  const sourceSlug = basename(filePath, ".pdf");

  const pages: Omit<PageData, "id">[] = [];
  let textExtractedPages = 0;
  let visionExtractedPages = 0;
  let visionFailedPages = 0;
  let canvasUnavailableWarned = false;

  async function renderPageAsBase64Png(
    page: Awaited<ReturnType<typeof doc.getPage>>
  ): Promise<string | null> {
    const createCanvas = await getCreateCanvas();
    if (!createCanvas) {
      if (!canvasUnavailableWarned) {
        console.log(
          "    Vision fallback skipped: no canvas backend available for PDF page rendering."
        );
        canvasUnavailableWarned = true;
      }
      return null;
    }

    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext("2d");

    await page.render({
      canvasContext: context as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;

    return canvas.toBuffer("image/png").toString("base64");
  }

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const parsedText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    let text = parsedText;
    let extractedViaVision = false;
    let extractionMethod: "text" | "vision" = "text";

    if (parsedText.length < 50) {
      try {
        const pageBase64Png = await renderPageAsBase64Png(page);
        if (pageBase64Png) {
          const visionResult = await extractPageTextWithVision(pageBase64Png);
          if (visionResult?.text) {
            text = visionResult.text.replace(/\s+\n/g, "\n").trim();
            extractedViaVision = true;
            extractionMethod = "vision";
            visionExtractedPages++;
          } else {
            visionFailedPages++;
          }
        } else {
          visionFailedPages++;
        }
      } catch (error) {
        visionFailedPages++;
        console.log(`    Vision extraction failed on page ${i}: ${error}`);
      }
    } else {
      textExtractedPages++;
    }

    if (!text.trim()) {
      // Keep empty pages out of the index if both text and vision extraction fail.
      continue;
    }

    if (!extractedViaVision && parsedText.length < 50) {
      // Very short text pages still get indexed but are marked as text-only fallback.
      textExtractedPages++;
    }

    pages.push({
      pageNumber: i,
      source: sourceSlug,
      sourceLabel: sourceSlug
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" "),
      text,
      section: detectSection(text, i),
      contentType: detectContentType(text),
      extractedViaVision,
      extractionMethod,
    });
  }

  return {
    pages,
    totalPages: doc.numPages,
    textExtractedPages,
    visionExtractedPages,
    visionFailedPages,
  };
}

export interface ParseAllPdfsResult {
  pages: PageData[];
  totalPagesSeen: number;
  textExtractedPages: number;
  visionExtractedPages: number;
  visionFailedPages: number;
}

export async function parseAllPdfs(
  filesDir: string
): Promise<ParseAllPdfsResult> {
  const files = readdirSync(filesDir).filter((f) => f.endsWith(".pdf"));
  const allPages: PageData[] = [];
  let totalPagesSeen = 0;
  let textExtractedPages = 0;
  let visionExtractedPages = 0;
  let visionFailedPages = 0;

  for (const file of files) {
    const filePath = join(filesDir, file);
    console.log(`  Parsing ${file}...`);
    const result = await parsePdfFile(filePath);
    totalPagesSeen += result.totalPages;
    textExtractedPages += result.textExtractedPages;
    visionExtractedPages += result.visionExtractedPages;
    visionFailedPages += result.visionFailedPages;
    for (const page of result.pages) {
      allPages.push({
        ...page,
        id: `${page.source}-p${page.pageNumber}`,
      });
    }
    console.log(
      `    -> ${result.pages.length} pages indexed (${result.textExtractedPages} text, ${result.visionExtractedPages} vision, ${result.visionFailedPages} vision-failed)`
    );
  }

  return {
    pages: allPages,
    totalPagesSeen,
    textExtractedPages,
    visionExtractedPages,
    visionFailedPages,
  };
}
