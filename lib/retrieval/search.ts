import MiniSearch from "minisearch";
import { loadIndex, loadPages, isIndexReady } from "../ingest/indexer";
import { parseAllPdfs } from "../ingest/pdf-parser";
import { buildIndex, saveIndex } from "../ingest/indexer";
import { join } from "path";
import { existsSync } from "fs";
import type { PageData, SearchResult } from "../types";

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
  const pages = await parseAllPdfs(filesDir);
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

  let results = index.search(query, {
    boost: { text: 2, section: 1.5 },
    fuzzy: 0.2,
    prefix: true,
    ...(options?.sectionFilter
      ? {
          filter: (result) => {
            const page = pages.find((p) => p.id === result.id);
            if (!page) return true;
            let match = true;
            if (options.sectionFilter) {
              match = match && page.section === options.sectionFilter;
            }
            if (options.sourceFilter) {
              match = match && page.source === options.sourceFilter;
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

  return results.slice(0, topK).map((r) => {
    const page = pages.find((p) => p.id === r.id);
    const text = page?.text ?? "";
    const queryWords = query.toLowerCase().split(/\s+/);
    let bestStart = 0;
    for (const word of queryWords) {
      const idx = text.toLowerCase().indexOf(word);
      if (idx !== -1) {
        bestStart = Math.max(0, idx - 80);
        break;
      }
    }
    const excerpt = text.slice(bestStart, bestStart + 300).trim();

    return {
      id: r.id,
      pageNumber: page?.pageNumber ?? 0,
      source: page?.source ?? "",
      sourceLabel: page?.sourceLabel ?? "",
      text: text,
      section: page?.section ?? "",
      score: r.score,
      excerpt: excerpt.length < text.length ? excerpt + "..." : excerpt,
    };
  });
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
