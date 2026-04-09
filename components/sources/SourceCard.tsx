"use client";

import type { Citation, PageImage } from "@/lib/types";

interface SourceCardProps {
  citation: Citation;
  pageImage?: PageImage;
  onOpen: () => void;
  highlighted?: boolean;
  delayMs?: number;
  anchorId?: string;
}

export default function SourceCard({
  citation,
  pageImage,
  onOpen,
  highlighted = false,
  delayMs = 0,
  anchorId,
}: SourceCardProps) {
  const imageSrc = pageImage?.imageUrl ?? pageImage?.url;

  return (
    <button
      id={anchorId}
      type="button"
      onClick={onOpen}
      className={`inline-flex h-[120px] w-[180px] shrink-0 flex-col overflow-hidden rounded-xl border bg-neutral-900/60 text-left shadow-sm transition-all duration-300 ease-out ${
        highlighted
          ? "border-brand/60 ring-1 ring-brand/40"
          : "border-neutral-800 hover:border-brand/35"
      } source-card-enter`}
      style={{ animationDelay: `${delayMs}ms` }}
    >
      {imageSrc ? (
        <>
          <div className="h-[70%] border-b border-neutral-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageSrc}
              alt={`${citation.sourceLabel} page ${citation.pageNumber}`}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="h-[30%] px-2 py-1.5">
            <p className="line-clamp-2 text-[11px] leading-snug text-neutral-300">
              {citation.excerpt}
            </p>
          </div>
        </>
      ) : (
        <div className="flex h-full flex-col justify-between p-2.5">
          <span className="text-[11px] font-semibold text-brand-hover">
            p.{citation.pageNumber}
          </span>
          <p className="line-clamp-5 text-[11px] leading-snug text-neutral-300">
            {citation.excerpt}
          </p>
        </div>
      )}
      <style jsx>{`
        .source-card-enter {
          opacity: 0;
          transform: translateY(6px);
          animation: sourceCardIn 260ms ease-out forwards;
        }
        @keyframes sourceCardIn {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </button>
  );
}
