"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, FileSearch } from "lucide-react";
import type { Citation, PageImage, SelectedSource } from "@/lib/types";
import SourceCard from "./SourceCard";

interface SourceRowProps {
  messageId: string;
  citations: Citation[];
  pageImages?: PageImage[];
  visible: boolean;
  highlightedSourceId?: string | null;
  selectedSourceId?: string | null;
  onSelectSource: (source: SelectedSource) => void;
}

function getSourceCardId(messageId: string, citation: Citation) {
  return `source-${messageId}-${citation.source}-${citation.pageNumber}`;
}

export default function SourceRow({
  messageId,
  citations,
  pageImages = [],
  visible,
  highlightedSourceId,
  selectedSourceId,
  onSelectSource,
}: SourceRowProps) {
  const [open, setOpen] = useState(false);

  const imageByKey = useMemo(() => {
    const map = new Map<string, PageImage>();
    for (const pageImage of pageImages) {
      map.set(`${pageImage.source}:${pageImage.pageNumber}`, pageImage);
    }
    return map;
  }, [pageImages]);

  useEffect(() => {
    if (highlightedSourceId) {
      setOpen(true);
    }
  }, [highlightedSourceId]);

  if (!visible || citations.length === 0) return null;

  return (
    <>
      <div className="mt-3 rounded-2xl border border-white/8 bg-neutral-950/50">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-neutral-300 transition-colors duration-150 hover:text-neutral-100"
        >
          <FileSearch size={14} className="shrink-0" />
          <span className="font-medium">
            Evidence
          </span>
          <span className="text-neutral-500">
            {citations.length} source{citations.length === 1 ? "" : "s"}
          </span>
          <ChevronDown
            size={14}
            className={`ml-auto transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </button>
        {open && (
          <div className="source-row flex gap-2.5 overflow-x-auto border-t border-white/6 px-3 pb-3 pt-2">
            {citations.map((citation, index) => {
              const pageImage = imageByKey.get(`${citation.source}:${citation.pageNumber}`);
              const sourceId = getSourceCardId(messageId, citation);
              return (
                <SourceCard
                  key={sourceId}
                  anchorId={sourceId}
                  citation={citation}
                  pageImage={pageImage}
                  delayMs={index * 80}
                  highlighted={highlightedSourceId === sourceId}
                  active={selectedSourceId === sourceId}
                  onOpen={() =>
                    onSelectSource({
                      sourceId,
                      messageId,
                      citation,
                      pageImage,
                    })
                  }
                />
              );
            })}
          </div>
        )}
      </div>
      <style jsx>{`
        .source-row {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .source-row::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      <style jsx global>{`
        @media (prefers-reduced-motion: reduce) {
          * {
            transition-duration: 0.01ms !important;
            animation: none !important;
          }
        }
      `}</style>
    </>
  );
}

export { getSourceCardId };
