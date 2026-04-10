import { NextRequest } from "next/server";
import { readFileSync, existsSync } from "fs";
import {
  getPageImagePath,
  getStaticPageImagePath,
  renderPageToPng,
} from "@/lib/ingest/page-renderer";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ source: string; page: string }> }
) {
  const { source, page } = await params;
  const pageNum = parseInt(page, 10);
  const highlightText = req.nextUrl.searchParams.get("highlight")?.trim() || undefined;

  if (isNaN(pageNum)) {
    return Response.json({ error: "Invalid page number" }, { status: 400 });
  }

  if (!highlightText) {
    const staticImagePath = getStaticPageImagePath(source, pageNum);
    if (existsSync(staticImagePath)) {
      const staticBuffer = readFileSync(staticImagePath);
      return new Response(staticBuffer, {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=86400",
        },
      });
    }

    const imagePath = getPageImagePath(source, pageNum);
    if (existsSync(imagePath)) {
      const buffer = readFileSync(imagePath);
      return new Response(buffer, {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=86400",
        },
      });
    }
  }

  const buffer = await renderPageToPng(source, pageNum, { highlightText });
  if (!buffer) {
    return Response.json({ error: "Page image not found." }, { status: 404 });
  }

  return new Response(buffer, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": highlightText
        ? "private, max-age=60"
        : "public, max-age=86400",
    },
  });
}
