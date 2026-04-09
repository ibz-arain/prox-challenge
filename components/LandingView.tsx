"use client";

import { useState, useEffect, useCallback, type FormEvent } from "react";
import { Search } from "lucide-react";
import type { WeldingSuggestion } from "@/lib/suggestionBank";

const TYPEWRITER_PROMPT =
  "What would you like to know about your OmniPro 220?";

type LandingViewProps = {
  sessionKey: number;
  pills: WeldingSuggestion[];
  onSubmitQuery: (query: string) => void;
  error: string | null;
  onDismissError: () => void;
  disabled: boolean;
};

export default function LandingView({
  sessionKey,
  pills,
  onSubmitQuery,
  error,
  onDismissError,
  disabled,
}: LandingViewProps) {
  const [typedPrompt, setTypedPrompt] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    setTypedPrompt("");
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const clearTimer = () => clearTimeout(timeoutId);

    timeoutId = window.setTimeout(() => {
      let pos = 0;
      const tick = () => {
        if (cancelled) return;
        pos += 1;
        setTypedPrompt(TYPEWRITER_PROMPT.slice(0, pos));
        if (pos >= TYPEWRITER_PROMPT.length) return;
        const delay = 45 + Math.random() * 55;
        timeoutId = window.setTimeout(tick, delay);
      };
      tick();
    }, 350);

    return () => {
      cancelled = true;
      clearTimer();
    };
  }, [sessionKey]);

  const handleSubmit = useCallback(
    (e?: FormEvent) => {
      e?.preventDefault();
      const q = query.trim();
      if (!q || disabled) return;
      onDismissError();
      onSubmitQuery(q);
      setQuery("");
    },
    [query, disabled, onSubmitQuery, onDismissError]
  );

  const displayPrompt = typedPrompt.length === 0 ? "\u00A0" : typedPrompt;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col px-4">
      <div className="absolute left-1/2 top-1/2 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 px-4">
        <h1 className="text-center text-2xl font-semibold leading-snug tracking-tight text-neutral-400 sm:text-4xl">
          {displayPrompt}
        </h1>

        <form
          onSubmit={handleSubmit}
          className="mt-8 w-full max-w-2xl"
        >
          <div
            className="flex w-full items-center gap-3 rounded-xl border border-neutral-700/80 bg-neutral-900/80 px-4 py-3 shadow-sm transition-all duration-500 ease-out focus-within:border-neutral-600 focus-within:bg-neutral-900 focus-within:shadow-md focus-within:ring-1 focus-within:ring-brand/20"
          >
            <Search
              className="h-5 w-5 shrink-0 text-neutral-500"
              strokeWidth={2}
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (error) onDismissError();
              }}
              disabled={disabled}
              placeholder="Ask about setup, settings, or troubleshooting…"
              className="min-w-0 flex-1 bg-transparent text-base text-neutral-100 placeholder:text-neutral-500 focus:outline-none disabled:opacity-60"
              autoComplete="off"
              aria-label="Search or ask a question"
            />
            <button
              type="submit"
              disabled={disabled || !query.trim()}
              className="shrink-0 rounded-lg bg-neutral-950 px-4 py-2 text-sm font-medium text-white transition-colors duration-500 ease-out hover:bg-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-40"
            >
              Search
            </button>
          </div>
        </form>

        {error && (
          <div
            className="mt-4 w-full rounded-xl border border-red-900/60 bg-red-950/50 px-4 py-3 text-sm text-red-200 shadow-sm ring-1 ring-red-500/20"
            role="alert"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="leading-relaxed">{error}</p>
              <button
                type="button"
                onClick={onDismissError}
                className="shrink-0 text-xs font-medium text-red-300 underline-offset-2 hover:underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {pills.map((p) => (
            <button
              key={`${p.label}-${p.query}`}
              type="button"
              disabled={disabled}
              onClick={() => {
                onDismissError();
                onSubmitQuery(p.query);
              }}
              className="rounded-lg bg-neutral-800/90 px-2.5 py-1 text-xs font-medium text-neutral-300 transition-colors duration-500 ease-out hover:bg-brand/20 hover:text-brand-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 disabled:opacity-50"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
