import {
  readFileSync,
  readdirSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from "fs";
import { join, basename } from "path";

const GENERATED_DIR = join(process.cwd(), "generated");
const IMAGES_DIR = join(GENERATED_DIR, "page-images");

export function getPageImagePath(source: string, pageNumber: number): string {
  return join(IMAGES_DIR, `${source}-page-${pageNumber}.png`);
}

export function pageImageExists(source: string, pageNumber: number): boolean {
  return existsSync(getPageImagePath(source, pageNumber));
}

export async function renderPageImages(filesDir: string): Promise<number> {
  if (!existsSync(IMAGES_DIR)) {
    mkdirSync(IMAGES_DIR, { recursive: true });
  }

  let createCanvasFn: ((w: number, h: number) => unknown) | null = null;
  try {
    const canvasModule = await (Function(
      'return import("canvas")'
    )() as Promise<{ createCanvas: (w: number, h: number) => unknown }>);
    createCanvasFn = canvasModule.createCanvas;
  } catch {
    console.log(
      "  canvas package not available — skipping page image rendering."
    );
    console.log(
      '  Install with: npm install canvas (requires system Cairo libs)'
    );
    console.log("  The app will work without page images.\n");
    return 0;
  }

  const pdfjs = await import("pdfjs-dist");
  const files = readdirSync(filesDir).filter((f) => f.endsWith(".pdf"));
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
        const canvas = createCanvasFn!(
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

        const buffer = canvas.toBuffer("image/png");
        writeFileSync(outPath, buffer);
        rendered++;
      } catch (err) {
        console.log(`    Warning: failed to render page ${i}: ${err}`);
      }
    }
  }

  console.log(`  ${rendered} page images rendered`);
  return rendered;
}
