"use client";

import { useEffect } from "react";
import type { Citation, PageImage } from "@/lib/types";

interface SourceModalProps {
  citation: Citation;
  pageImage?: PageImage;
  onClose: () => void;
}

export default function SourceModal({
  citation,
  pageImage,
  onClose,
}: SourceModalProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 p-4 transition-opacity duration-300 ease-out sm:p-8"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="mx-auto flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950 shadow-lg"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="border-b border-neutral-800 px-4 py-3">
          <p className="text-sm font-semibold text-neutral-100">
            {citation.sourceLabel} - p.{citation.pageNumber}
          </p>
        </div>
        <div className="flex-1 overflow-y-auto sleek-scrollbar p-4">
          {pageImage?.imageUrl || pageImage?.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={pageImage.imageUrl ?? pageImage.url}
              alt={`${citation.sourceLabel} page ${citation.pageNumber}`}
              className="w-full rounded-lg border border-neutral-800"
            />
          ) : (
            <p className="text-sm leading-relaxed text-neutral-300">
              {citation.excerpt}
            </p>
          )}
          {pageImage?.excerpt && (
            <p className="mt-4 text-sm leading-relaxed text-neutral-400">
              {pageImage.excerpt}
            </p>
          )}
        </div>
      </div>
      <style jsx global>{`
        @media (prefers-reduced-motion: reduce) {
          * {
            transition-duration: 0.01ms !important;
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
