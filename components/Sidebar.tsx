"use client";

import { useState, useEffect } from "react";
import {
  Zap,
  CheckCircle2,
  AlertCircle,
  Loader2,
  MessageSquare,
} from "lucide-react";
import type { IngestStatus } from "@/lib/types";

interface SidebarProps {
  onSamplePrompt: (prompt: string) => void;
}

const SAMPLE_PROMPTS = [
  {
    label: "Duty cycle at 200A",
    prompt: "What's the duty cycle for MIG welding at 200A on 240V?",
  },
  {
    label: "Flux-cored porosity",
    prompt:
      "I'm getting porosity in my flux-cored welds. What should I check?",
  },
  {
    label: "TIG polarity setup",
    prompt: "What polarity setup do I need for TIG welding?",
  },
  {
    label: "Ground clamp socket",
    prompt: "Show me which socket the ground clamp goes in.",
  },
  {
    label: "Settings for mild steel",
    prompt: "Help me choose settings for 1/8 inch mild steel on 240V",
  },
  {
    label: "120V vs 240V",
    prompt: "What's the difference between 120V and 240V mode?",
  },
];

export default function Sidebar({ onSamplePrompt }: SidebarProps) {
  const [status, setStatus] = useState<IngestStatus | null>(null);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ ready: false, totalPages: 0, sources: [] }));
  }, []);

  return (
    <div className="h-full flex flex-col bg-[var(--color-surface)] border-r border-[var(--color-border)]">
      {/* Product Header */}
      <div className="p-5 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--color-accent)]/20 flex items-center justify-center">
            <Zap size={20} className="text-[var(--color-accent)]" />
          </div>
          <div>
            <h1 className="text-sm font-bold leading-tight">OmniPro 220</h1>
            <p className="text-xs text-[var(--color-text-muted)]">
              Technical Support
            </p>
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/product.webp"
          alt="Vulcan OmniPro 220"
          className="w-full rounded-lg border border-[var(--color-border)] mb-3"
        />
        <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
          Multiprocess welder supporting MIG, Flux-Cored, TIG, and Stick
          welding. 120V/240V dual input with synergic LCD controls.
        </p>
      </div>

      {/* Sample Prompts */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare size={13} className="text-[var(--color-text-muted)]" />
          <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
            Try asking
          </span>
        </div>
        <div className="space-y-2">
          {SAMPLE_PROMPTS.map((sp, i) => (
            <button
              key={i}
              onClick={() => onSamplePrompt(sp.prompt)}
              className="w-full text-left p-3 rounded-lg bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] border border-[var(--color-border)] hover:border-[var(--color-accent)]/40 transition-all group"
            >
              <span className="text-xs font-medium text-[var(--color-text)] group-hover:text-[var(--color-accent)] transition-colors">
                {sp.label}
              </span>
              <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5 line-clamp-2">
                {sp.prompt}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Status */}
      <div className="p-4 border-t border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          {status === null ? (
            <Loader2
              size={13}
              className="animate-spin text-[var(--color-text-muted)]"
            />
          ) : status.ready ? (
            <CheckCircle2 size={13} className="text-[var(--color-success)]" />
          ) : (
            <AlertCircle size={13} className="text-[var(--color-warning)]" />
          )}
          <span className="text-xs text-[var(--color-text-muted)]">
            {status === null
              ? "Checking index..."
              : status.ready
                ? `Ready — ${status.totalPages} pages indexed`
                : "Building index..."}
          </span>
        </div>
      </div>
    </div>
  );
}
