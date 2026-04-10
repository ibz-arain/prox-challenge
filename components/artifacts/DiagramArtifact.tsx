"use client";

import { GitBranch } from "lucide-react";
import HtmlArtifact from "./HtmlArtifact";

interface DiagramArtifactProps {
  title: string;
  content: string;
}

export default function DiagramArtifact({
  title,
  content,
}: DiagramArtifactProps) {
  const svgMatch = content.match(/<svg[\s\S]*<\/svg>/i);
  const svgContent = svgMatch ? svgMatch[0] : null;

  if (!svgContent) {
    return (
      <div className="artifact-card my-4">
        <div className="artifact-card-header">
          <GitBranch size={14} />
          {title}
        </div>
        <div className="p-4 text-sm text-neutral-400">
          <pre className="whitespace-pre-wrap leading-relaxed">{content}</pre>
        </div>
      </div>
    );
  }

  return (
    <HtmlArtifact
      title={title}
      content={JSON.stringify({
        html: `<div class="diagram-shell"><div class="diagram-stage">${svgContent}</div></div>`,
        css: `
          .diagram-shell {
            padding: 18px;
            background:
              radial-gradient(circle at top, rgba(239,99,0,0.12), transparent 40%),
              linear-gradient(180deg, #111214, #0b0b0c);
          }
          .diagram-stage {
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 360px;
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 18px;
            background: rgba(12,12,13,0.92);
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.03);
            padding: 20px;
          }
          svg {
            max-width: 100%;
            height: auto;
            filter: drop-shadow(0 10px 24px rgba(0,0,0,0.32));
          }
        `,
        height: 440,
      })}
    />
  );
}
