"use client";

import { useMemo } from "react";
import { CodeXml } from "lucide-react";

interface HtmlArtifactProps {
  title: string;
  content: string;
}

interface HtmlArtifactPayload {
  html?: string;
  css?: string;
  js?: string;
  height?: number;
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

export default function HtmlArtifact({ title, content }: HtmlArtifactProps) {
  const payload = parsePayload(content);

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
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root { color-scheme: dark; }
      html, body {
        margin: 0;
        padding: 0;
        background: #0a0a0a;
        color: #e5e7eb;
        font-family: Inter, ui-sans-serif, system-ui, sans-serif;
      }
      * { box-sizing: border-box; }
      ${payload.css ?? ""}
    </style>
  </head>
  <body>
    ${payload.html ?? "<div></div>"}
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
  </body>
</html>`;
  }, [payload]);

  if (!payload || !srcDoc) {
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
        sandbox="allow-scripts"
        srcDoc={srcDoc}
        className="w-full border-0 bg-neutral-950"
        style={{ height: Math.min(Math.max(payload.height ?? 360, 220), 720) }}
      />
    </div>
  );
}
