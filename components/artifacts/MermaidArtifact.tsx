"use client";

import { useEffect, useId, useRef, useState } from "react";
import { GitBranch } from "lucide-react";

interface MermaidArtifactProps {
  title: string;
  content: string;
}

let mermaidInitialized = false;

function stripOptionalFence(source: string): string {
  let s = source.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:mermaid)?\s*\n?/i, "");
    s = s.replace(/\n?```\s*$/i, "");
  }
  return s.trim();
}

/** Mermaid 11 expects a valid HTML id (no spaces) and a real container node for render(). */
function makeRenderId(reactId: string): string {
  const base = reactId.replace(/[^a-zA-Z0-9_-]/g, "");
  const suffix =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, "")
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`;
  return `mmd-${base || "x"}-${suffix}`;
}

/** Models often emit `A ---|x| B` (undirected); Mermaid 11 flowcharts expect `A -->|x| B`. */
function normalizeFlowchartEdges(def: string): string {
  return def.replace(/\s+---+(\|[^|]+\|)/g, " -->$1");
}

export default function MermaidArtifact({ title, content }: MermaidArtifactProps) {
  const reactId = useId().replace(/:/g, "");
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setError(null);
    let diagram = stripOptionalFence(content);
    if (!diagram) {
      setError("Empty diagram");
      setReady(false);
      return;
    }
    diagram = normalizeFlowchartEdges(diagram);

    const run = async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        if (!mermaidInitialized) {
          mermaid.initialize({
            theme: "dark",
            startOnLoad: false,
            securityLevel: "loose",
          });
          mermaidInitialized = true;
        }

        const host = containerRef.current;
        if (!host || cancelled) return;

        const renderId = makeRenderId(reactId);
        const { svg, bindFunctions } = await mermaid.render(renderId, diagram, host);
        if (cancelled || !containerRef.current) return;

        containerRef.current.innerHTML = svg;
        bindFunctions?.(containerRef.current);
        setError(null);
        setReady(true);
      } catch (e) {
        if (!cancelled) {
          if (containerRef.current) {
            containerRef.current.innerHTML = "";
          }
          setError(e instanceof Error ? e.message : String(e));
          setReady(false);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [content, reactId]);

  return (
    <div className="artifact-card my-4">
      <div className="artifact-card-header">
        <GitBranch size={14} />
        {title}
      </div>
      {error && (
        <div className="space-y-2 border-b border-white/8 px-4 py-3">
          <p className="text-sm text-red-400/90">Could not render diagram: {error}</p>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-neutral-500">
            {stripOptionalFence(content)}
          </pre>
        </div>
      )}
      <div
        className="mermaid-stage p-4 overflow-x-auto"
        style={{
          background:
            "radial-gradient(circle at top, rgba(239,99,0,0.08), transparent 45%), linear-gradient(180deg, #111214, #0b0b0c)",
        }}
      >
        <div
          ref={containerRef}
          className="flex min-h-[200px] justify-center [&_svg]:max-w-full [&_svg]:h-auto"
          aria-busy={!ready && !error}
          aria-hidden={!!error}
        />
      </div>
    </div>
  );
}
