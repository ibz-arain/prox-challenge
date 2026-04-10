import type { Citation, PageImage } from "./types";

export function buildPageImageUrl(
  source: string,
  pageNumber: number,
  highlightText?: string
): string {
  const params = new URLSearchParams();
  const normalizedHighlight = highlightText?.trim();

  if (normalizedHighlight) {
    params.set("highlight", normalizedHighlight);
  }

  const query = params.toString();
  return `/api/pages/${encodeURIComponent(source)}/${pageNumber}${query ? `?${query}` : ""}`;
}

export function buildPageImageFromCitation(
  citation: Citation,
  pageImage?: Partial<PageImage>,
  options?: { highlightText?: string }
): PageImage {
  const excerpt = pageImage?.excerpt || citation.excerpt;
  const url =
    options?.highlightText
      ? buildPageImageUrl(
          citation.source,
          citation.pageNumber,
          options.highlightText
        )
      : pageImage?.url || buildPageImageUrl(citation.source, citation.pageNumber);

  return {
    pageNumber: citation.pageNumber,
    source: citation.source,
    sourceLabel: citation.sourceLabel,
    excerpt,
    url,
    imageUrl: options?.highlightText ? url : pageImage?.imageUrl || url,
  };
}
