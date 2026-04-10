"use client";

import { ListOrdered } from "lucide-react";

interface StepListArtifactProps {
  title: string;
  content: string;
}

interface StepItem {
  title: string;
  detail?: string;
}

function parseSteps(content: string): StepItem[] | null {
  try {
    const parsed = JSON.parse(content) as { steps?: unknown };
    if (!parsed.steps || !Array.isArray(parsed.steps)) return null;
    return parsed.steps.map((s) => {
      if (typeof s === "string") return { title: s };
      const o = s as Record<string, unknown>;
      return {
        title: String(o.title ?? ""),
        detail: o.detail != null ? String(o.detail) : undefined,
      };
    });
  } catch {
    return null;
  }
}

export default function StepListArtifact({ title, content }: StepListArtifactProps) {
  const steps = parseSteps(content);

  if (!steps || steps.length === 0) {
    return (
      <div className="artifact-card my-4">
        <div className="artifact-card-header">
          <ListOrdered size={14} />
          {title}
        </div>
        <div className="p-4 text-sm text-neutral-400">
          <pre className="whitespace-pre-wrap leading-relaxed">{content}</pre>
        </div>
      </div>
    );
  }

  return (
    <div className="artifact-card my-4">
      <div className="artifact-card-header">
        <ListOrdered size={14} />
        {title}
      </div>
      <ol className="p-4 space-y-3 list-decimal list-inside marker:text-brand marker:font-semibold">
        {steps.map((step, i) => (
          <li key={i} className="text-sm text-neutral-200 leading-relaxed">
            <span className="font-medium text-neutral-100">{step.title}</span>
            {step.detail ? (
              <span className="block mt-1 pl-0 text-neutral-400 text-[13px] leading-snug">
                {step.detail}
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
