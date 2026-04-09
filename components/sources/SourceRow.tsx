"use client";

import { useMemo, useState } from "react";
import type { Citation, PageImage } from "@/lib/types";
import SourceCard from "./SourceCard";
import SourceModal from "./SourceModal";

interface SourceRowProps {
  messageId: string;
  citations: Citation[];
  pageImages?: PageImage[];
  visible: boolean;
  highlightedSourceId?: string | null;
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
}: SourceRowProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const imageByKey = useMemo(() => {
    const map = new Map<string, PageImage>();
    for (const pageImage of pageImages) {
      map.set(`${pageImage.source}:${pageImage.pageNumber}`, pageImage);
    }
    return map;
  }, [pageImages]);

  if (!visible || citations.length === 0) return null;

  const selectedCitation = selectedIndex === null ? null : citations[selectedIndex];
  const selectedPageImage =
    selectedCitation == null
      ? undefined
      : imageByKey.get(`${selectedCitation.source}:${selectedCitation.pageNumber}`);

  return (
    <>
      <div className="source-row mt-3 flex gap-2.5 overflow-x-auto pb-1">
        {citations.map((citation, index) => {
          const pageImage = imageByKey.get(`${citation.source}:${citation.pageNumber}`);
          const sourceId = getSourceCardId(messageId, citation);
          return (
            <SourceCard
              key={sourceId}
              anchorId={sourceId}
              citation={citation}
              pageImage={pageImage}
              delayMs={index * 100}
              highlighted={highlightedSourceId === sourceId}
              onOpen={() => setSelectedIndex(index)}
            />
          );
        })}
      </div>
      {selectedCitation && (
        <SourceModal
          citation={selectedCitation}
          pageImage={selectedPageImage}
          onClose={() => setSelectedIndex(null)}
        />
      )}
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
