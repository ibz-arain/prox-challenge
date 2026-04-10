import { join } from "path";

/**
 * Writable directory for search index, pages.json, and optional PNG cache.
 * On Vercel/Lambda only /tmp is writable; /var/task is read-only.
 */
export function getGeneratedDir(): string {
  if (process.env.GENERATED_DIR) {
    return process.env.GENERATED_DIR;
  }
  if (process.env.VERCEL === "1" || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return "/tmp/omnipro-generated";
  }
  return join(process.cwd(), "generated");
}

export function getPageImagesDir(): string {
  return join(getGeneratedDir(), "page-images");
}

export function getFilesDir(): string {
  return join(process.cwd(), "files");
}

/** Optional legacy pre-rendered PNGs (local dev / older setups). Read-only on Vercel. */
export function getStaticManualPagesDir(): string {
  return join(process.cwd(), "public", "manual-pages");
}
