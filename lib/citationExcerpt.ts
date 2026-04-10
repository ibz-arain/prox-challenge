/**
 * Build readable citation excerpts by skipping repeated manual headers/footers
 * (phone, item number, etc.) and anchoring search snippets on meaningful query terms.
 */

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "for",
  "to",
  "of",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "in",
  "on",
  "at",
  "with",
  "by",
  "from",
  "as",
  "or",
  "and",
  "but",
  "if",
  "when",
  "what",
  "which",
  "who",
  "how",
  "this",
  "that",
  "these",
  "those",
  "it",
  "its",
  "do",
  "does",
  "did",
  "so",
  "we",
  "you",
  "your",
]);

function isBoilerplateLine(line: string): boolean {
  const t = line.trim();
  if (t.length < 4) return true;
  if (/1[-\s]?800[-\s]?\d{3}[-\s]?\d{4}/.test(t)) return true;
  if (/Item\s*57812/i.test(t)) return true;
  if (/For technical questions|please call|Harbor\s+Freight|harborfreight/i.test(t)) {
    return true;
  }
  if (/^Owner'?s?\s+Manual|Manual\s+No\.?\s*\d/i.test(t)) return true;
  if (/^\d{1,3}\s*$/.test(t)) return true;
  if (/Vulcan|OmniPro\s*220/i.test(t) && t.length < 90) return true;
  return false;
}

/** Index of first non-boilerplate character (skip repeated headers/footers at top of page text). */
export function skipLeadingBoilerplateRegion(text: string): number {
  const maxScan = Math.min(4000, text.length);
  const chunk = text.slice(0, maxScan);
  const lines = chunk.split(/\n/);
  let offset = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.length === 0) {
      offset += lines[i].length + 1;
      continue;
    }
    if (isBoilerplateLine(line)) {
      offset += lines[i].length + 1;
    } else {
      break;
    }
  }
  return Math.min(offset, text.length);
}

/** Extra cleanup for UI / markdown tables when excerpts still start with boilerplate. */
export function sanitizeExcerptForDisplay(excerpt: string, maxLen = 140): string {
  let s = trimExcerptStartNoise(excerpt);
  s = s.replace(/\s+/g, " ").trim();
  if (s.length > maxLen) {
    return `${s.slice(0, maxLen)}...`;
  }
  return s;
}

function trimExcerptStartNoise(excerpt: string): string {
  let s = excerpt;
  const noise =
    /^(?:[\s\u00a0]*)(?:ns,?\s*)?(?:please\s+call\s*)?(?:1[-\s]?800[-\s]?\d{3}[-\s]?\d{4}[^\n.]*[.…]?\s*)+/i;
  for (let i = 0; i < 4; i++) {
    const next = s.replace(noise, "").replace(/^(?:Item\s*57812[^\n]*\n?)+/i, "").trim();
    if (next === s) break;
    s = next;
  }
  return s;
}

function trimTrailingEllipsis(excerpt: string, shortened: boolean): string {
  const o = excerpt.trim();
  if (!shortened) return o;
  if (o.endsWith("…") || o.endsWith("...")) return o;
  return o.length > 0 ? `${o}...` : o;
}

/** First window of page text after boilerplate — for get_page / page image captions. */
export function pickPageLeadExcerpt(text: string, maxLen = 220): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "";

  const skip = skipLeadingBoilerplateRegion(text);
  const shortened = text.length > skip + maxLen;
  let excerpt = text.slice(skip, skip + maxLen).trim();
  excerpt = trimExcerptStartNoise(excerpt);
  return trimTrailingEllipsis(excerpt, shortened);
}

/** Snippet around the best query term match, avoiding header/footer-only windows. */
export function pickSearchExcerpt(text: string, query: string, maxLen = 300): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "";

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const queryWords = lowerQuery.split(/\s+/).filter(Boolean);
  const contentWords = queryWords.filter((w) => w.length > 2 && !STOPWORDS.has(w));
  const words = contentWords.length > 0 ? contentWords : queryWords;

  let anchor = -1;
  for (const w of words) {
    const idx = lowerText.indexOf(w);
    if (idx !== -1) {
      anchor = idx;
      break;
    }
  }

  const skip = skipLeadingBoilerplateRegion(text);

  if (anchor === -1) {
    return pickPageLeadExcerpt(text, maxLen);
  }

  let start = Math.max(0, anchor - 100);
  if (start < skip) {
    start = Math.max(skip, anchor - 100);
  }

  const shortened = text.length > start + maxLen;
  let excerpt = text.slice(start, start + maxLen).trim();
  excerpt = trimExcerptStartNoise(excerpt);
  if (excerpt.length < 24) {
    excerpt = text.slice(anchor, Math.min(text.length, anchor + maxLen)).trim();
    excerpt = trimExcerptStartNoise(excerpt);
  }
  if (excerpt.length < 24) {
    return pickPageLeadExcerpt(text, maxLen);
  }
  return trimTrailingEllipsis(excerpt, shortened);
}
