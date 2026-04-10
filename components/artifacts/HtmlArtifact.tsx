"use client";

import { useEffect, useMemo, useRef } from "react";
import { CodeXml } from "lucide-react";
import { extractSuggestionRowsFromHtml } from "@/lib/htmlArtifactSuggestions";

/** Iframe → parent: load this text into the chat composer (see page listener). */
export const COMPOSER_FILL_MESSAGE_TYPE = "omni-composer-fill";

interface HtmlArtifactProps {
  title: string;
  content: string;
  /** When set, suggestion rows fill the composer (native buttons — iframe is not used for lists). */
  onFillComposer?: (text: string) => void;
}

interface HtmlArtifactPayload {
  html?: string;
  css?: string;
  js?: string;
  height?: number;
  /** Structured suggestions (preferred); avoids iframe postMessage for clicks. */
  suggestions?: { label: string; query: string }[];
}

const BLOCKED_PATTERNS = [
  /<script[\s>]/i,
  /<\/script>/i,
  /https?:\/\/(?!www\.w3\.org)/i,
  /import\s*\(/i,
  /document\.cookie/i,
  /localStorage/i,
  /sessionStorage/i,
  /window\.top/i,
  /parent\./i,
];

function parsePayload(content: string): HtmlArtifactPayload | null {
  try {
    const parsed = JSON.parse(content) as HtmlArtifactPayload;
    return parsed;
  } catch {
    return null;
  }
}

function isSafeSnippet(value: string | undefined) {
  if (!value) return true;
  return !BLOCKED_PATTERNS.some((pattern) => pattern.test(value));
}

export default function HtmlArtifact({
  title,
  content,
  onFillComposer,
}: HtmlArtifactProps) {
  const payload = useMemo(() => parsePayload(content), [content]);
  const fillRef = useRef(onFillComposer);
  fillRef.current = onFillComposer;

  const suggestionRows = useMemo(() => {
    if (!payload) return [];
    if (Array.isArray(payload.suggestions) && payload.suggestions.length > 0) {
      return payload.suggestions.map((s) => ({
        query: s.query,
        display: `${s.label} — ${s.query}`,
      }));
    }
    if (payload.html) {
      return extractSuggestionRowsFromHtml(payload.html);
    }
    return [];
  }, [payload]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const data = e.data as { type?: string; query?: string };
      if (
        data?.type === COMPOSER_FILL_MESSAGE_TYPE &&
        typeof data.query === "string" &&
        data.query.trim()
      ) {
        fillRef.current?.(data.query.trim());
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const srcDoc = useMemo(() => {
    if (!payload) return null;
    if (
      !isSafeSnippet(payload.html) ||
      !isSafeSnippet(payload.css) ||
      !isSafeSnippet(payload.js)
    ) {
      return null;
    }

    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="color-scheme" content="dark" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root { color-scheme: dark; }
      html, body {
        margin: 0;
        padding: 0;
        background: #0a0a0a !important;
        color: #e5e7eb !important;
        font-family: Inter, ui-sans-serif, system-ui, sans-serif;
      }
      * { box-sizing: border-box; }
      ${payload.css ?? ""}
      /* Always dark: appended after agent CSS so light surfaces from the model are neutralized */
      .artifact-html-root {
        min-height: 100%;
        background: #0a0a0a !important;
        color: #e5e7eb !important;
        color-scheme: dark;
      }
      .artifact-html-root * {
        color-scheme: dark;
      }
      .artifact-html-root a {
        color: #93c5fd !important;
      }
      .artifact-html-root strong {
        color: #fafafa !important;
      }
      .artifact-html-root li,
      .artifact-html-root ul,
      .artifact-html-root ol,
      .artifact-html-root article,
      .artifact-html-root section,
      .artifact-html-root aside,
      .artifact-html-root .card,
      .artifact-html-root [class*="card"],
      .artifact-html-root [class*="Card"] {
        background-color: #171717 !important;
        color: #e5e7eb !important;
        border-color: rgba(255, 255, 255, 0.1) !important;
      }
      .artifact-html-root [style*="background"] {
        background-color: #171717 !important;
        background-image: none !important;
      }
      .artifact-html-root ul[data-suggestions] li {
        cursor: pointer !important;
        border-radius: 10px;
        padding: 8px 10px !important;
        margin: 6px -4px !important;
        transition: background 0.15s ease;
      }
      .artifact-html-root ul[data-suggestions] li:hover {
        background-color: rgba(255, 255, 255, 0.08) !important;
      }
      .artifact-html-root [data-artifact-query] {
        cursor: pointer !important;
      }
    </style>
  </head>
  <body>
    <div class="artifact-html-root">
    ${payload.html ?? "<div></div>"}
    </div>
    <script>
      (() => {
        try {
          ${payload.js ?? ""}
        } catch (error) {
          const pre = document.createElement("pre");
          pre.textContent = "Artifact error: " + String(error);
          pre.style.color = "#fca5a5";
          pre.style.padding = "12px";
          document.body.appendChild(pre);
        }
      })();
    </script>
    <script>
      (function () {
        function fillQuery(q) {
          var q2 = (q || "").trim();
          if (!q2) return;
          try {
            window.parent.postMessage(
              { type: "${COMPOSER_FILL_MESSAGE_TYPE}", query: q2 },
              "*"
            );
          } catch (e) {}
        }
        function eventTargetElement(target) {
          if (!target) return null;
          if (target.nodeType === 1) return target;
          return target.parentElement;
        }
        function run() {
          var root = document.querySelector(".artifact-html-root");
          if (!root) return;
          root.addEventListener("click", function (e) {
            var t = eventTargetElement(e.target);
            if (!t || !t.closest) return;
            var direct = t.closest("[data-artifact-query]");
            if (direct) {
              var dq = direct.getAttribute("data-artifact-query");
              if (dq) {
                fillQuery(dq);
                return;
              }
            }
            var li = t.closest("ul[data-suggestions] li");
            if (!li || !root.contains(li)) return;
            var attr = li.getAttribute("data-artifact-query");
            if (attr) {
              fillQuery(attr);
              return;
            }
            var text = (li.textContent || "").trim();
            var m = /(?:\u2014|\u2013|-)\s*(.+)/.exec(text);
            fillQuery(m ? m[1].trim() : text);
          });
        }
        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", run);
        } else {
          run();
        }
      })();
    </script>
  </body>
</html>`;
  }, [payload]);

  if (!payload) {
    return (
      <div className="artifact-card my-4">
        <div className="artifact-card-header">
          <CodeXml size={14} />
          {title}
        </div>
        <div className="p-4 text-sm text-neutral-400">
          <pre className="whitespace-pre-wrap leading-relaxed">{content}</pre>
        </div>
      </div>
    );
  }

  if (suggestionRows.length > 0) {
    const minH = Math.min(Math.max(payload.height ?? 360, 220), 720);
    return (
      <div className="artifact-card my-4 overflow-hidden ring-1 ring-brand/10 shadow-[0_12px_40px_rgba(0,0,0,0.32)]">
        <div className="artifact-card-header">
          <CodeXml size={14} />
          {title}
        </div>
        <div
          className="space-y-1.5 border-t border-white/6 bg-neutral-950/80 p-3"
          style={{ minHeight: Math.min(minH, 420) }}
        >
          <p className="mb-1 text-[11px] text-neutral-500">
            Click a line to paste it into the message box.
          </p>
          {suggestionRows.map((row, i) => (
            <button
              key={`${row.query.slice(0, 48)}-${i}`}
              type="button"
              disabled={!onFillComposer}
              onClick={() => onFillComposer?.(row.query)}
              className={`w-full rounded-xl border border-white/10 bg-neutral-900/90 px-3 py-2.5 text-left text-[13px] leading-snug text-neutral-200 shadow-sm ring-1 ring-white/5 transition-colors ${
                onFillComposer
                  ? "cursor-pointer hover:border-brand/35 hover:bg-neutral-800/95"
                  : "cursor-default opacity-80"
              }`}
            >
              {row.display}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (!srcDoc) {
    return (
      <div className="artifact-card my-4">
        <div className="artifact-card-header">
          <CodeXml size={14} />
          {title}
        </div>
        <div className="p-4 text-sm text-neutral-400">
          <pre className="whitespace-pre-wrap leading-relaxed">{content}</pre>
        </div>
      </div>
    );
  }

  return (
    <div className="artifact-card my-4 overflow-hidden ring-1 ring-brand/10 shadow-[0_12px_40px_rgba(0,0,0,0.32)]">
      <div className="artifact-card-header">
        <CodeXml size={14} />
        {title}
      </div>
      <iframe
        title={title}
        sandbox="allow-scripts allow-same-origin"
        srcDoc={srcDoc}
        className="w-full border-0 bg-neutral-950"
        style={{ height: Math.min(Math.max(payload.height ?? 360, 220), 720) }}
      />
    </div>
  );
}
