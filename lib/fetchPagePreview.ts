/**
 * Client-side: load manual page PNG. Use POST + JSON body for highlights so long
 * excerpts never hit GET URL limits on Vercel.
 */
export async function fetchPagePreviewPng(
  source: string,
  pageNumber: number,
  highlight?: string
): Promise<Blob> {
  const path = `/api/pages/${encodeURIComponent(source)}/${pageNumber}`;
  const trimmed = highlight?.trim();

  if (!trimmed) {
    const res = await fetch(path);
    if (!res.ok) {
      throw new Error(`page preview ${res.status}`);
    }
    return res.blob();
  }

  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ highlight: trimmed }),
  });
  if (!res.ok) {
    throw new Error(`page preview ${res.status}`);
  }
  return res.blob();
}
