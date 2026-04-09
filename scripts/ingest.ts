import { existsSync } from "fs";
import { join } from "path";
import { parseAllPdfs } from "../lib/ingest/pdf-parser";
import { buildIndex, saveIndex } from "../lib/ingest/indexer";
import { renderPageImages } from "../lib/ingest/page-renderer";

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
  const pages = await parseAllPdfs(FILES_DIR);
  console.log(`  Total: ${pages.length} pages extracted\n`);

  console.log("Step 2: Building search index...");
  const index = buildIndex(pages);
  saveIndex(index, pages);
  console.log("");

  console.log("Step 3: Rendering page images...");
  await renderPageImages(FILES_DIR);
  console.log("");

  console.log("=== Ingestion complete! ===");
  console.log("Run `npm run dev` to start the app.");
}

main().catch((err) => {
  console.error("Ingestion failed:", err);
  process.exit(1);
});
