import type { Citation, PageImage } from "./types";

/**
 * Use for <img src> only. Long ?highlight= query strings (URL-encoded excerpts)
 * exceed Vercel/CDN limits and return 404. Excerpt highlighting stays in UI text.
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
