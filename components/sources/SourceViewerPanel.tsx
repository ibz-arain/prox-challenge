"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, LoaderCircle, ScanSearch, X } from "lucide-react";
import type { SelectedSource } from "@/lib/types";
import { buildPageImageUrl } from "@/lib/evidence";
import { sanitizeExcerptForDisplay } from "@/lib/citationExcerpt";

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
  const rawExcerpt =
    source.citation.excerpt || source.pageImage?.excerpt || "No excerpt available.";
  const supportingExcerpt =
    sanitizeExcerptForDisplay(rawExcerpt, 620) || rawExcerpt;
  const imageSrc = useMemo(() => {
    if (source.pageImage?.imageUrl) return source.pageImage.imageUrl;
    if (source.pageImage?.url) return source.pageImage.url;
    const highlight =
      sanitizeExcerptForDisplay(source.citation.excerpt || "", 480) ||
      source.citation.excerpt ||
      "";
    return buildPageImageUrl(
      source.citation.source,
      source.citation.pageNumber,
      highlight || undefined
    );
  }, [
    source.citation.excerpt,
    source.citation.pageNumber,
    source.citation.source,
    source.pageImage?.imageUrl,
    source.pageImage?.url,
  ]);
  const [imageState, setImageState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    setImageState("loading");
  }, [imageSrc]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-neutral-950/96 backdrop-blur-xl">
        <div className="flex shrink-0 items-center gap-3 border-b border-white/8 px-4 pt-5 pb-3 sm:px-6 md:px-4 md:pt-5 md:pb-3 lg:px-4">
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
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-neutral-500 transition-colors hover:bg-white/6 hover:text-neutral-100"
            aria-label="Close evidence viewer"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="sleek-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="space-y-4 pb-8">
            <div className="overflow-hidden rounded-2xl border border-white/8 bg-neutral-900/80">
              <div className="flex items-center gap-2 border-b border-white/8 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
                <ScanSearch className="h-3.5 w-3.5 text-brand-hover" />
                Cited page preview
              </div>
              <div className="relative min-h-80 bg-neutral-950">
                {imageState === "loading" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-neutral-950/90">
                    <div className="flex items-center gap-2 text-sm text-neutral-400">
                      <LoaderCircle className="h-4 w-4 animate-spin text-brand-hover" />
                      Rendering cited page...
                    </div>
                  </div>
                )}
                {imageState === "error" && (
                  <div className="flex min-h-80 items-center justify-center px-6 text-center text-sm leading-6 text-neutral-400">
                    Couldn&apos;t render this page preview yet. The cited excerpt is still shown
                    below.
                  </div>
                )}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageSrc}
                  alt={`${source.citation.sourceLabel} page ${source.citation.pageNumber}`}
                  className={`w-full bg-white object-contain transition-opacity duration-200 ${
                    imageState === "ready" ? "opacity-100" : "opacity-0"
                  }`}
                  onLoad={() => setImageState("ready")}
                  onError={() => setImageState("error")}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-brand/20 bg-linear-to-br from-brand/12 via-brand/8 to-transparent p-4">
              <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-200/90">
                <ExternalLink className="h-3.5 w-3.5" />
                Highlighted support
              </div>
              <p className="text-sm leading-7 text-neutral-100">
                {renderHighlightedExcerpt(supportingExcerpt)}
              </p>
              <p className="mt-3 text-xs leading-5 text-neutral-500">
                The preview requests this exact excerpt and highlights the matching text on the
                rendered page when the PDF text layer can be resolved.
              </p>
            </div>

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
    </div>
  );
}
