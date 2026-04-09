import { existsSync } from "fs";
import { join } from "path";
import { parseAllPdfs } from "../lib/ingest/pdf-parser";
import { buildIndex, saveIndex } from "../lib/ingest/indexer";
import {
  renderPageImages,
  renderCriticalPageImages,
} from "../lib/ingest/page-renderer";

const FILES_DIR = join(process.cwd(), "files");

async function main() {
  console.log("=== OmniPro 220 Manual Ingestion ===\n");

  if (!existsSync(FILES_DIR)) {
    console.error(
      "Error: files/ directory not found. Place PDF manuals in files/ and try again."
    );
    process.exit(1);
  }

  console.log("Step 1: Extracting text from PDFs...");
  const parseResult = await parseAllPdfs(FILES_DIR);
  const pages = parseResult.pages;
  console.log(`  Total pages seen: ${parseResult.totalPagesSeen}`);
  console.log(`  Indexed pages: ${pages.length}`);
  console.log(
    `  Extraction mix: ${parseResult.textExtractedPages} text, ${parseResult.visionExtractedPages} vision, ${parseResult.visionFailedPages} vision-failed\n`
  );

  console.log("Step 2: Building search index...");
  const index = buildIndex(pages);
  saveIndex(index, pages);
  console.log("");

  console.log("Step 3: Pre-rendering critical static page images...");
  await renderCriticalPageImages(FILES_DIR, pages);
  console.log("");

  console.log("Step 4: Rendering dynamic page image cache...");
  await renderPageImages(FILES_DIR);
  console.log("");

  console.log("=== Ingestion complete! ===");
  console.log("Run `npm run dev` to start the app.");
}

main().catch((err) => {
  console.error("Ingestion failed:", err);
  process.exit(1);
});
