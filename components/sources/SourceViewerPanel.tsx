"use client";

import { ChevronRight, ExternalLink, X } from "lucide-react";
import type { SelectedSource } from "@/lib/types";

interface SourceViewerPanelProps {
  source: SelectedSource;
  onClose: () => void;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function splitExcerpt(excerpt: string) {
  return excerpt
    .replace(/\s+/g, " ")
    .split("...")
    .map((part) => part.trim())
    .filter(Boolean);
}

function renderHighlightedExcerpt(excerpt: string) {
  const parts = splitExcerpt(excerpt);
  if (parts.length === 0) return excerpt;

  const pattern = new RegExp(`(${parts.map(escapeRegExp).join("|")})`, "gi");
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(excerpt)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(excerpt.slice(lastIndex, match.index));
    }
    nodes.push(
      <mark
        key={`${match.index}-${match[0]}`}
        className="rounded bg-brand/20 px-1 py-0.5 text-orange-200 ring-1 ring-brand/30"
      >
        {match[0]}
      </mark>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < excerpt.length) {
    nodes.push(excerpt.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : excerpt;
}

export default function SourceViewerPanel({
  source,
  onClose,
}: SourceViewerPanelProps) {
  const imageSrc = source.pageImage?.imageUrl ?? source.pageImage?.url;
  const supportingExcerpt =
    source.citation.excerpt || source.pageImage?.excerpt || "No excerpt available.";

  return (
    <aside className="sticky top-20 h-[calc(100vh-6rem)] min-h-128 w-full max-w-136 shrink-0 self-start overflow-hidden rounded-3xl border border-white/10 bg-neutral-950/85 shadow-[0_20px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
      <div className="flex items-center gap-3 border-b border-white/8 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-hover/90">
            Evidence Viewer
          </p>
          <p className="truncate text-sm font-semibold text-neutral-100">
            {source.citation.sourceLabel} · p.{source.citation.pageNumber}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-white/6 hover:text-neutral-100"
          aria-label="Close evidence viewer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="sleek-scrollbar h-full overflow-y-auto px-4 py-4">
        <div className="space-y-4 pb-8">
          <div className="rounded-2xl border border-brand/20 bg-linear-to-br from-brand/12 via-brand/8 to-transparent p-4">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-200/90">
              <ExternalLink className="h-3.5 w-3.5" />
              Highlighted support
            </div>
            <p className="text-sm leading-7 text-neutral-100">
              {renderHighlightedExcerpt(supportingExcerpt)}
            </p>
          </div>

          {imageSrc ? (
            <div className="overflow-hidden rounded-2xl border border-white/8 bg-neutral-900">
              <div className="flex items-center gap-2 border-b border-white/8 px-3 py-2 text-xs text-neutral-400">
                <ChevronRight className="h-3.5 w-3.5" />
                Manual page render
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageSrc}
                alt={`${source.citation.sourceLabel} page ${source.citation.pageNumber}`}
                className="w-full bg-white object-contain"
              />
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/12 bg-neutral-900/60 px-4 py-6 text-sm text-neutral-400">
              Page image is not available for this source yet, but the cited excerpt is shown above.
            </div>
          )}

          {source.pageImage?.excerpt &&
          source.pageImage.excerpt !== source.citation.excerpt ? (
            <div className="rounded-2xl border border-white/8 bg-neutral-900/70 p-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                Page context
              </p>
              <p className="text-sm leading-7 text-neutral-300">
                {source.pageImage.excerpt}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
