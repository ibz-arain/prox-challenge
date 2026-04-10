import MiniSearch from "minisearch";
import { loadIndex, loadPages, isIndexReady } from "../ingest/indexer";
import { parseAllPdfs } from "../ingest/pdf-parser";
import { buildIndex, saveIndex } from "../ingest/indexer";
import { join } from "path";
import { existsSync } from "fs";
import type { PageData, SearchResult } from "../types";
import { pickSearchExcerpt } from "../citationExcerpt";

let cachedIndex: MiniSearch<PageData> | null = null;
let cachedPages: PageData[] | null = null;

async function ensureIndex(): Promise<{
  index: MiniSearch<PageData>;
  pages: PageData[];
}> {
  if (cachedIndex && cachedPages) {
    return { index: cachedIndex, pages: cachedPages };
  }

  if (isIndexReady()) {
    cachedIndex = loadIndex();
    cachedPages = loadPages();
    if (cachedIndex && cachedPages) {
      return { index: cachedIndex, pages: cachedPages };
    }
  }

  const filesDir = join(process.cwd(), "files");
  if (!existsSync(filesDir)) {
    throw new Error(
      "No files/ directory found and no pre-built index. Run npm run ingest first."
    );
  }

  console.log("Auto-ingesting manuals on first request...");
  const parseResult = await parseAllPdfs(filesDir);
  const pages = parseResult.pages;
  console.log(
    `Auto-ingest extraction mix: ${parseResult.textExtractedPages} text, ${parseResult.visionExtractedPages} vision, ${parseResult.visionFailedPages} vision-failed`
  );
  const index = buildIndex(pages);
  saveIndex(index, pages);

  cachedIndex = index;
  cachedPages = pages;
  return { index, pages };
}

export async function searchManual(
  query: string,
  options?: {
    sectionFilter?: string;
    sourceFilter?: string;
    topK?: number;
  }
): Promise<SearchResult[]> {
  const { index, pages } = await ensureIndex();
  const topK = options?.topK ?? 5;
  const normalizedQuery = query.toLowerCase();
  const queryWords = normalizedQuery.split(/\s+/).filter(Boolean);
  const sectionFilter = options?.sectionFilter;
  const sourceFilter = options?.sourceFilter;
  const needsSectionFilter = Boolean(sectionFilter || sourceFilter);

  let results = index.search(query, {
    boost: { text: 2, section: 1.5 },
    fuzzy: 0.2,
    prefix: true,
    ...(needsSectionFilter
      ? {
          filter: (result) => {
            const page = pages.find((p) => p.id === result.id);
            if (!page) return true;
            let match = true;
            if (sectionFilter) {
              match = match && page.section === sectionFilter;
            }
            if (sourceFilter) {
              match = match && page.source === sourceFilter;
            }
            return match;
          },
        }
      : {}),
  });

  if (results.length === 0) {
    results = index.search(query, {
      fuzzy: 0.4,
      prefix: true,
    });
  }

  return results
    .map((r) => {
      const page = pages.find((p) => p.id === r.id);
      const text = page?.text ?? "";
      const lowerText = text.toLowerCase();
      let keywordHits = 0;
      for (const word of queryWords) {
        const idx = lowerText.indexOf(word);
        if (idx !== -1) {
          keywordHits += 1;
        }
      }
      const excerpt = pickSearchExcerpt(text, query, 300);
      const sectionBonus =
        options?.sectionFilter && page?.section === options.sectionFilter ? 40 : 0;
      const keywordBonus = keywordHits * 10;
      const setupBonus =
        normalizedQuery.includes("ground") && normalizedQuery.includes("clamp") && page?.section === "setup"
          ? 18
          : 0;
      const polarityBonus =
        normalizedQuery.includes("polarity") &&
        (page?.section === "polarity" || page?.section === "setup" || page?.section === "welding-process")
          ? 22
          : 0;
      const troubleshootingBonus =
        normalizedQuery.includes("porosity") && page?.section === "troubleshooting" ? 22 : 0;

      return {
        id: r.id,
        pageNumber: page?.pageNumber ?? 0,
        source: page?.source ?? "",
        sourceLabel: page?.sourceLabel ?? "",
        text,
        section: page?.section ?? "",
        score: r.score + sectionBonus + keywordBonus + setupBonus + polarityBonus + troubleshootingBonus,
        excerpt: excerpt.length < text.length ? excerpt + "..." : excerpt,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

export async function getPageContent(
  pageNumber: number,
  source?: string
): Promise<PageData | null> {
  const { pages } = await ensureIndex();
  return (
    pages.find(
      (p) =>
        p.pageNumber === pageNumber && (!source || p.source === source)
    ) ?? null
  );
}

export async function getAllPages(): Promise<PageData[]> {
  const { pages } = await ensureIndex();
  return pages;
}
