import { readFileSync, readdirSync } from "fs";
import { join, basename } from "path";
import type { PageData } from "../types";

let pdfjsLib: typeof import("pdfjs-dist") | null = null;

async function getPdfjs() {
  if (!pdfjsLib) {
    pdfjsLib = await import("pdfjs-dist");
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
): Promise<Omit<PageData, "id">[]> {
  const pdfjs = await getPdfjs();
  const data = new Uint8Array(readFileSync(filePath));
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  const sourceSlug = basename(filePath, ".pdf");

  const pages: Omit<PageData, "id">[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (text.length < 10) continue;

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
    });
  }

  return pages;
}

export async function parseAllPdfs(filesDir: string): Promise<PageData[]> {
  const files = readdirSync(filesDir).filter((f) => f.endsWith(".pdf"));
  const allPages: PageData[] = [];

  for (const file of files) {
    const filePath = join(filesDir, file);
    console.log(`  Parsing ${file}...`);
    const pages = await parsePdfFile(filePath);
    for (const page of pages) {
      allPages.push({
        ...page,
        id: `${page.source}-p${page.pageNumber}`,
      });
    }
    console.log(`    -> ${pages.length} pages extracted`);
  }

  return allPages;
}
