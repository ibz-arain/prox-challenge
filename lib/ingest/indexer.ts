import MiniSearch from "minisearch";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import type { PageData, IngestStatus } from "../types";
import { getGeneratedDir } from "../paths";

const GENERATED_DIR = getGeneratedDir();
const INDEX_PATH = join(GENERATED_DIR, "index.json");
const PAGES_PATH = join(GENERATED_DIR, "pages.json");
const STATUS_PATH = join(GENERATED_DIR, "status.json");

export function buildIndex(pages: PageData[]): MiniSearch<PageData> {
  const index = new MiniSearch<PageData>({
    fields: ["text", "section", "sourceLabel"],
    storeFields: [
      "pageNumber",
      "source",
      "sourceLabel",
      "text",
      "section",
      "contentType",
      "extractedViaVision",
      "extractionMethod",
    ],
    searchOptions: {
      boost: { text: 2, section: 1.5 },
      fuzzy: 0.2,
      prefix: true,
    },
  });

  index.addAll(pages);
  return index;
}

export function saveIndex(index: MiniSearch<PageData>, pages: PageData[]) {
  if (!existsSync(GENERATED_DIR)) {
    mkdirSync(GENERATED_DIR, { recursive: true });
  }

  writeFileSync(INDEX_PATH, JSON.stringify(index.toJSON()));
  writeFileSync(PAGES_PATH, JSON.stringify(pages, null, 2));

  const status: IngestStatus = {
    ready: true,
    totalPages: pages.length,
    sources: [...new Set(pages.map((p) => p.source))],
    indexedAt: new Date().toISOString(),
  };
  writeFileSync(STATUS_PATH, JSON.stringify(status, null, 2));

  console.log(`  Index saved: ${pages.length} pages`);
  console.log(`  Sources: ${status.sources.join(", ")}`);
}

export function loadIndex(): MiniSearch<PageData> | null {
  if (!existsSync(INDEX_PATH)) return null;

  try {
    const raw = readFileSync(INDEX_PATH, "utf-8");
    return MiniSearch.loadJSON<PageData>(raw, {
      fields: ["text", "section", "sourceLabel"],
      storeFields: [
        "pageNumber",
        "source",
        "sourceLabel",
        "text",
        "section",
        "contentType",
        "extractedViaVision",
        "extractionMethod",
      ],
    });
  } catch {
    return null;
  }
}

export function loadPages(): PageData[] {
  if (!existsSync(PAGES_PATH)) return [];
  try {
    return JSON.parse(readFileSync(PAGES_PATH, "utf-8"));
  } catch {
    return [];
  }
}

export function loadStatus(): IngestStatus {
  if (!existsSync(STATUS_PATH)) {
    return { ready: false, totalPages: 0, sources: [] };
  }
  try {
    return JSON.parse(readFileSync(STATUS_PATH, "utf-8"));
  } catch {
    return { ready: false, totalPages: 0, sources: [] };
  }
}

export function isIndexReady(): boolean {
  return existsSync(INDEX_PATH) && existsSync(PAGES_PATH);
}
