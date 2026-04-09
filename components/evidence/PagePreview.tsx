"use client";

import { useState } from "react";
import { FileImage, X, ZoomIn } from "lucide-react";
import type { PageImage } from "@/lib/types";

interface PagePreviewProps {
  pageImage: PageImage;
}

export default function PagePreview({ pageImage }: PagePreviewProps) {
  const [expanded, setExpanded] = useState(false);
  const [imgError, setImgError] = useState(false);

  if (imgError) {
    return (
      <div className="p-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
        <div className="flex items-center gap-2 mb-1.5">
          <FileImage size={12} className="text-[var(--color-text-muted)]" />
          <span className="text-xs font-semibold text-[var(--color-text-muted)]">
            {pageImage.sourceLabel} — Page {pageImage.pageNumber}
          </span>
        </div>
        <p className="text-xs text-[var(--color-text-muted)]">
          Page image is unavailable for this reference.
        </p>
        {pageImage.excerpt && (
          <p className="mt-2 text-xs leading-relaxed text-[var(--color-text)]">
            {pageImage.excerpt}
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden hover:border-[var(--color-accent)]/50 transition-colors">
        <div className="flex items-center gap-2 px-3 py-2 bg-[var(--color-surface-2)]">
          <FileImage size={12} className="text-[var(--color-accent)]" />
          <span className="text-xs font-semibold text-[var(--color-accent)]">
            {pageImage.sourceLabel}
          </span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--color-accent)]/20 text-[var(--color-accent)] font-mono">
            p.{pageImage.pageNumber}
          </span>
          <button
            onClick={() => setExpanded(true)}
            className="ml-auto p-1 hover:bg-[var(--color-surface-3)] rounded transition-colors"
            title="Expand image"
          >
            <ZoomIn size={12} className="text-[var(--color-text-muted)]" />
          </button>
        </div>
        <div
          className="cursor-pointer"
          onClick={() => setExpanded(true)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={pageImage.url}
            alt={`${pageImage.sourceLabel} page ${pageImage.pageNumber}`}
            className="w-full h-auto"
            onError={() => setImgError(true)}
          />
        </div>
      </div>

      {expanded && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8"
          onClick={() => setExpanded(false)}
        >
          <div className="relative max-w-4xl max-h-full overflow-auto">
            <button
              onClick={() => setExpanded(false)}
              className="absolute top-2 right-2 p-2 bg-[var(--color-surface)] rounded-full hover:bg-[var(--color-surface-2)] transition-colors z-10"
            >
              <X size={16} />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={pageImage.url}
              alt={`${pageImage.sourceLabel} page ${pageImage.pageNumber}`}
              className="max-w-full h-auto rounded-lg"
              onError={() => {
                setExpanded(false);
                setImgError(true);
              }}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </>
  );
}
