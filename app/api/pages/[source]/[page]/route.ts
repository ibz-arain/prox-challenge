import { NextRequest } from "next/server";
import { readFileSync, existsSync } from "fs";
import { getPageImagePath } from "@/lib/ingest/page-renderer";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ source: string; page: string }> }
) {
  const { source, page } = await params;
  const pageNum = parseInt(page, 10);

  if (isNaN(pageNum)) {
    return Response.json({ error: "Invalid page number" }, { status: 400 });
  }

  const imagePath = getPageImagePath(source, pageNum);

  if (!existsSync(imagePath)) {
    return Response.json(
      { error: "Page image not found. Run npm run ingest to generate page images." },
      { status: 404 }
    );
  }

  const buffer = readFileSync(imagePath);
  return new Response(buffer, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
