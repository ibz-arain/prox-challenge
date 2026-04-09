"use client";

import { BookOpen } from "lucide-react";
import type { Citation } from "@/lib/types";

interface CitationCardProps {
  citation: Citation;
}

export default function CitationCard({ citation }: CitationCardProps) {
  return (
    <div className="p-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-accent)]/50 transition-colors">
      <div className="flex items-center gap-2 mb-1.5">
        <BookOpen size={12} className="text-[var(--color-accent)]" />
        <span className="text-xs font-semibold text-[var(--color-accent)]">
          {citation.sourceLabel}
        </span>
        <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--color-accent)]/20 text-[var(--color-accent)] font-mono">
          p.{citation.pageNumber}
        </span>
      </div>
      <p className="text-xs text-[var(--color-text-muted)] line-clamp-3 leading-relaxed">
        {citation.excerpt}
      </p>
    </div>
  );
}
