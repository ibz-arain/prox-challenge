/**
 * Normalize image MIME for Anthropic Messages API (base64 image blocks).
 * @see https://docs.anthropic.com/en/api/messages
 */
export type AnthropicImageMediaType =
  | "image/jpeg"
  | "image/png"
  | "image/gif"
  | "image/webp";

export function normalizeAnthropicImageMediaType(
  mimeHint: string | undefined,
  base64Data: string
): AnthropicImageMediaType {
  const trimmed = (mimeHint ?? "").trim().toLowerCase();
  if (trimmed === "image/jpeg" || trimmed === "image/jpg") {
    return "image/jpeg";
  }
  if (trimmed === "image/png") return "image/png";
  if (trimmed === "image/gif") return "image/gif";
  if (trimmed === "image/webp") return "image/webp";

  const head = base64Data.slice(0, 24);
  if (head.startsWith("/9j/")) return "image/jpeg";
  if (head.startsWith("iVBOR")) return "image/png";
  if (head.startsWith("R0lGOD")) return "image/gif";
  if (head.startsWith("UklGR")) return "image/webp";

  return "image/png";
}

/** Data URL for displaying a stored base64 image in the UI. */
export function dataUrlFromBase64(
  base64: string,
  mimeHint?: string
): string {
  const mime = normalizeAnthropicImageMediaType(mimeHint, base64);
  return `data:${mime};base64,${base64}`;
}
