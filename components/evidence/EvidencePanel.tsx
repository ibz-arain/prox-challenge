"use client";

import { useState } from "react";
import { BookMarked, Image, Layers } from "lucide-react";
import CitationCard from "./CitationCard";
import PagePreview from "./PagePreview";
import ArtifactRenderer from "../artifacts/ArtifactRenderer";
import type { Citation, Artifact, PageImage } from "@/lib/types";

interface EvidencePanelProps {
  citations: Citation[];
  artifacts: Artifact[];
  pageImages: PageImage[];
}

type Tab = "sources" | "visuals" | "artifacts";

export default function EvidencePanel({
  citations,
  artifacts,
  pageImages,
}: EvidencePanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>("sources");

  const hasContent =
    citations.length > 0 || artifacts.length > 0 || pageImages.length > 0;

  if (!hasContent) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-6 text-center">
        <BookMarked
          size={32}
          className="text-[var(--color-border)] mb-3"
        />
        <p className="text-sm font-medium text-[var(--color-text-muted)]">
          Evidence & Sources
        </p>
        <p className="text-xs text-[var(--color-text-muted)] mt-1 max-w-[200px]">
          Citations, manual pages, and visual artifacts will appear here as you
          chat.
        </p>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode; count: number }[] =
    [
      {
        id: "sources",
        label: "Sources",
        icon: <BookMarked size={13} />,
        count: citations.length,
      },
      {
        id: "visuals",
        label: "Pages",
        icon: <Image size={13} />,
        count: pageImages.length,
      },
      {
        id: "artifacts",
        label: "Artifacts",
        icon: <Layers size={13} />,
        count: artifacts.length,
      },
    ];

  return (
    <div className="h-full flex flex-col">
      <div className="flex border-b border-[var(--color-border)] px-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors border-b-2 ${
              activeTab === tab.id
                ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.count > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-[var(--color-surface-3)] text-[10px]">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-3">
        {activeTab === "sources" &&
          citations.map((c, i) => <CitationCard key={i} citation={c} />)}

        {activeTab === "visuals" &&
          pageImages.map((p, i) => <PagePreview key={i} pageImage={p} />)}

        {activeTab === "artifacts" &&
          artifacts.map((a, i) => <ArtifactRenderer key={i} artifact={a} />)}

        {activeTab === "sources" && citations.length === 0 && (
          <p className="text-xs text-[var(--color-text-muted)] text-center py-4">
            No source citations yet.
          </p>
        )}
        {activeTab === "visuals" && pageImages.length === 0 && (
          <p className="text-xs text-[var(--color-text-muted)] text-center py-4">
            No page images referenced yet.
          </p>
        )}
        {activeTab === "artifacts" && artifacts.length === 0 && (
          <p className="text-xs text-[var(--color-text-muted)] text-center py-4">
            No artifacts generated yet.
          </p>
        )}
      </div>
    </div>
  );
}
