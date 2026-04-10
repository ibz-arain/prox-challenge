import type { Citation, PageImage } from "./types";

/**
 * Plain GET URL (no highlight). For PDF text overlays on the image, the client
 * uses `fetchPagePreviewPng` (POST body) — see `lib/fetchPagePreview.ts`.
 */
export function buildPageImageUrl(source: string, pageNumber: number): string {
  return `/api/pages/${encodeURIComponent(source)}/${pageNumber}`;
}

export function buildPageImageFromCitation(
  citation: Citation,
  pageImage?: Partial<PageImage>
): PageImage {
  const excerpt = pageImage?.excerpt || citation.excerpt;
  const url = pageImage?.url || buildPageImageUrl(citation.source, citation.pageNumber);

  return {
    pageNumber: citation.pageNumber,
    source: citation.source,
    sourceLabel: citation.sourceLabel,
    excerpt,
    url,
    imageUrl: pageImage?.imageUrl || url,
  };
}
