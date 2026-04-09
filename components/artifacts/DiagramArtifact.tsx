"use client";

import { GitBranch } from "lucide-react";

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
        <div className="p-4 text-sm text-[var(--color-text-muted)]">
          <pre className="whitespace-pre-wrap">{content}</pre>
        </div>
      </div>
    );
  }

  return (
    <div className="artifact-card my-4">
      <div className="artifact-card-header">
        <GitBranch size={14} />
        {title}
      </div>
      <div
        className="p-4 flex justify-center bg-[var(--color-surface)] [&_svg]:max-w-full [&_svg]:h-auto"
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
    </div>
  );
}
