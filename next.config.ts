import type { NextConfig } from "next";

/** Bundled into routes that load PDF.js so Vercel includes the fake-worker script. */
const PDFJS_WORKER_TRACE_FILES = [
  "./node_modules/pdfjs-dist/build/pdf.worker.mjs",
  "./node_modules/pdfjs-dist/build/pdf.worker.min.mjs",
  "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
  "./node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs",
];

const FILES_PDF_TRACE = [
  "./files/**/*.pdf",
  "./files/owner-manual.pdf",
  "./files/quick-start-guide.pdf",
  "./files/selection-chart.pdf",
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfjs-dist", "canvas", "@napi-rs/canvas"],
  outputFileTracingIncludes: {
    "/api/chat": [...PDFJS_WORKER_TRACE_FILES, ...FILES_PDF_TRACE],
    "/api/pages/[source]/[page]": [...PDFJS_WORKER_TRACE_FILES, ...FILES_PDF_TRACE],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
