/** Decode common entities in attribute values from artifact HTML. */
export function decodeBasicHtmlEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export type HtmlArtifactSuggestionRow = {
  query: string;
  /** Visible line (label + query or plain query). */
  display: string;
};

/**
 * Pull clickable suggestions from agent HTML: <li data-artifact-query="...">...</li>
 */
export function extractSuggestionRowsFromHtml(
  html: string
): HtmlArtifactSuggestionRow[] {
  const rows: HtmlArtifactSuggestionRow[] = [];
  const re =
    /<li\b[^>]*\bdata-artifact-query="([^"]*)"[^>]*>([\s\S]*?)<\/li>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const query = decodeBasicHtmlEntities(m[1]).trim();
    if (!query) continue;
    const inner = m[2]
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    rows.push({ query, display: inner || query });
  }
  if (rows.length > 0) return rows;

  const attrRe = /\bdata-artifact-query="([^"]*)"/g;
  while ((m = attrRe.exec(html)) !== null) {
    const query = decodeBasicHtmlEntities(m[1]).trim();
    if (!query) continue;
    rows.push({ query, display: query });
  }
  return rows;
}
