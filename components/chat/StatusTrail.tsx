"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import {
  BookOpen,
  ChevronRight,
  CircleDot,
  FileSearch,
  Image as ImageIcon,
  Loader2,
  Search,
  Sparkles,
  Wrench,
} from "lucide-react";

interface StatusTrailProps {
  statuses: string[];
  hasTextStarted: boolean;
  isDone: boolean;
}

function iconForLine(line: string) {
  const l = line.toLowerCase();
  if (l.includes("putting it together")) return Sparkles;
  if (l.includes("double-checking") || l.includes("one more look")) return FileSearch;
  if (l.includes("synthesiz")) return Sparkles;
  if (l.includes("searching") || l.includes("search")) return Search;
  if (l.includes("reading") || l.includes("read page") || l.includes("read pages"))
    return BookOpen;
  if (
    l.includes("pulling") ||
    l.includes("pulled") ||
    l.includes("diagram") ||
    l.includes("loading") ||
    l.includes("got the")
  )
    return ImageIcon;
  if (l.includes("found")) return FileSearch;
  if (l.includes("spec") || l.includes("looking up")) return Wrench;
  return CircleDot;
}

const LINE_LEADING = "text-[13px] leading-snug";

function StatusLine({
  line,
  latest,
  toolsInProgress,
  animateIn,
  style,
}: {
  line: string;
  latest: boolean;
  toolsInProgress: boolean;
  animateIn?: boolean;
  style?: CSSProperties;
}) {
  const Icon = iconForLine(line);
  return (
    <li
      style={style}
      className={`flex min-w-0 gap-2 ${animateIn ? "chat-status-line-enter" : ""}`}
    >
      <span
        className={`inline-flex h-4.5 shrink-0 items-center text-neutral-500 ${
          toolsInProgress ? "text-brand-hover" : ""
        }`}
        aria-hidden
      >
        {toolsInProgress ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin stroke-2" />
        ) : (
          <Icon className="h-3.5 w-3.5 stroke-2" />
        )}
      </span>
      <span
        className={`min-w-0 flex-1 ${LINE_LEADING} ${
          latest ? "text-neutral-200" : "text-neutral-500"
        } ${toolsInProgress ? "chat-status-shine" : ""}`}
      >
        {line}
      </span>
    </li>
  );
}

function thinkingSecondsFromRefs(
  phaseStart: number | null,
  thinkingEnd: number | null
): number {
  const end = thinkingEnd ?? Date.now();
  const start = phaseStart ?? end;
  return Math.max(1, Math.round((end - start) / 1000));
}

export default function StatusTrail({
  statuses,
  hasTextStarted,
  isDone,
}: StatusTrailProps) {
  const [expanded, setExpanded] = useState(false);
  const [persisted, setPersisted] = useState<{
    lines: string[];
    seconds: number;
  } | null>(null);

  const phaseStartRef = useRef<number | null>(null);
  const thinkingEndRef = useRef<number | null>(null);

  useEffect(() => {
    if (statuses.length === 0) return;
    if (phaseStartRef.current === null) {
      phaseStartRef.current = Date.now();
    }
  }, [statuses.length]);

  useEffect(() => {
    if (hasTextStarted && thinkingEndRef.current === null) {
      thinkingEndRef.current = Date.now();
    }
  }, [hasTextStarted]);

  useLayoutEffect(() => {
    if (!isDone || persisted) return;
    if (statuses.length === 0) return;
    setPersisted({
      lines: [...statuses],
      seconds: thinkingSecondsFromRefs(
        phaseStartRef.current,
        thinkingEndRef.current
      ),
    });
  }, [isDone, statuses, persisted]);

  if (statuses.length === 0 && !persisted) {
    return null;
  }

  const collapseData =
    persisted ??
    (isDone && statuses.length > 0
      ? {
          lines: [...statuses],
          seconds: thinkingSecondsFromRefs(
            phaseStartRef.current,
            thinkingEndRef.current
          ),
        }
      : null);

  if (isDone) {
    if (!collapseData) {
      return null;
    }
    return (
      <div className="mb-2 min-w-0" aria-label="Assistant thinking summary">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full min-w-0 items-center gap-1.5 rounded-md py-1 text-left text-[13px] transition-colors hover:text-neutral-300 focus:outline-none focus-visible:text-neutral-200"
          aria-expanded={expanded}
        >
          <ChevronRight
            className={`h-4 w-4 shrink-0 text-neutral-600 transition-transform duration-200 ${
              expanded ? "rotate-90" : ""
            }`}
            aria-hidden
          />
          <span className="min-w-0 truncate text-neutral-400">
            Thinking · {collapseData.seconds}s
          </span>
        </button>
        {expanded && (
          <ul className="mt-2 space-y-2 border-l border-white/10 pl-3">
            {collapseData.lines.map((line, index) => (
              <StatusLine
                key={`done-${index}`}
                line={line}
                latest={index === collapseData.lines.length - 1}
                toolsInProgress={false}
                animateIn
                style={{
                  animationDelay: `${Math.min(index * 40, 400)}ms`,
                }}
              />
            ))}
          </ul>
        )}
      </div>
    );
  }

  const visibleStatuses = statuses;
  const isLatest = (index: number) => index === visibleStatuses.length - 1;
  const streamActive = statuses.length > 0;

  return (
    <div
      className="mb-2 min-w-0"
      aria-live="polite"
      aria-label="Assistant activity"
    >
      <ul className="space-y-2">
        {visibleStatuses.map((line, index) => {
          const latest = isLatest(index);
          const toolsInProgress = Boolean(latest && streamActive && !isDone);
          return (
            <StatusLine
              key={`live-${index}`}
              line={line}
              latest={latest}
              toolsInProgress={toolsInProgress}
              animateIn
            />
          );
        })}
      </ul>
    </div>
  );
}
