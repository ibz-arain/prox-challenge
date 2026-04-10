"use client";

import { useState } from "react";
import { GitBranch, ChevronRight } from "lucide-react";
import MermaidArtifact from "./MermaidArtifact";

interface FlowStep {
  id: string;
  text: string;
  type: "start" | "decision" | "action" | "end";
  yes?: string;
  no?: string;
  next?: string;
}

interface FlowchartArtifactProps {
  title: string;
  content: string;
}

function parseFlowchart(content: string): FlowStep[] | null {
  try {
    const parsed = JSON.parse(content);
    if (parsed.steps && Array.isArray(parsed.steps)) {
      return parsed.steps;
    }
    return null;
  } catch {
    return null;
  }
}

function looksLikeMermaid(source: string): boolean {
  const s = source.trim();
  if (!s) return false;
  return /^(?:graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|mindmap)\b/i.test(
    s
  );
}

export default function FlowchartArtifact({
  title,
  content,
}: FlowchartArtifactProps) {
  const steps = parseFlowchart(content);
  const [currentStep, setCurrentStep] = useState<string | null>(null);

  if (!steps) {
    if (looksLikeMermaid(content)) {
      return <MermaidArtifact title={title} content={content} />;
    }
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

  const activeStep = currentStep
    ? steps.find((s) => s.id === currentStep)
    : null;

  const colorMap = {
    start: "border-brand bg-brand/10 ring-1 ring-brand/25 text-neutral-100",
    decision: "border-orange-500 bg-orange-950/40 ring-1 ring-orange-500/25 text-neutral-100",
    action: "border-green-600 bg-green-950/40 ring-1 ring-green-600/25 text-neutral-100",
    end: "border-neutral-600 bg-neutral-800 ring-1 ring-neutral-700 text-neutral-200",
  };

  return (
    <div className="artifact-card my-4">
      <div className="artifact-card-header">
        <GitBranch size={14} />
        {title}
        {!currentStep && (
          <button
            type="button"
            onClick={() => setCurrentStep(steps[0]?.id ?? null)}
            className="ml-auto text-xs font-medium px-3 py-1.5 rounded-lg bg-neutral-950 text-white shadow-sm ring-1 ring-neutral-800 transition-colors duration-500 ease-out hover:bg-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            Start Interactive Mode
          </button>
        )}
        {currentStep && (
          <button
            type="button"
            onClick={() => setCurrentStep(null)}
            className="ml-auto text-xs font-medium px-3 py-1.5 rounded-lg border border-neutral-700 bg-neutral-900 text-neutral-300 shadow-sm transition-colors duration-500 ease-out hover:border-brand/40 hover:bg-brand/10 focus:outline-none focus-visible:ring-1 focus-visible:ring-brand/25"
          >
            Show All Steps
          </button>
        )}
      </div>
      <div className="p-4 space-y-2">
        {currentStep && activeStep ? (
          <div className="space-y-4">
            <div
              className={`p-4 rounded-lg border-2 ${colorMap[activeStep.type]}`}
            >
              <p className="text-sm font-medium">{activeStep.text}</p>
            </div>
            {activeStep.type === "decision" && (
              <div className="flex gap-3">
                {activeStep.yes && (
                  <button
                    type="button"
                    onClick={() => setCurrentStep(activeStep.yes!)}
                    className="flex-1 px-4 py-2 rounded-xl border border-green-600/50 bg-green-950/50 text-sm font-medium text-green-300 transition-colors duration-500 ease-out hover:bg-green-900/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500/30"
                  >
                    Yes
                  </button>
                )}
                {activeStep.no && (
                  <button
                    type="button"
                    onClick={() => setCurrentStep(activeStep.no!)}
                    className="flex-1 px-4 py-2 rounded-xl border border-red-600/50 bg-red-950/50 text-sm font-medium text-red-300 transition-colors duration-500 ease-out hover:bg-red-900/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30"
                  >
                    No
                  </button>
                )}
              </div>
            )}
            {activeStep.next && (
              <button
                type="button"
                onClick={() => setCurrentStep(activeStep.next!)}
                className="w-full px-4 py-2 rounded-xl border border-neutral-700 bg-neutral-900 text-sm font-medium text-neutral-200 shadow-sm transition-colors duration-500 ease-out hover:border-brand/35 hover:bg-brand/10 flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-1 focus-visible:ring-brand/25"
              >
                Next <ChevronRight size={14} strokeWidth={2} />
              </button>
            )}
            {activeStep.type === "end" && (
              <button
                type="button"
                onClick={() => setCurrentStep(steps[0]?.id ?? null)}
                className="w-full px-4 py-2 rounded-xl bg-neutral-950 text-white text-sm font-medium shadow-sm ring-1 ring-neutral-800 transition-colors duration-500 ease-out hover:bg-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
              >
                Start Over
              </button>
            )}
          </div>
        ) : (
          steps.map((step, i) => (
            <div key={step.id} className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-neutral-800 flex items-center justify-center text-xs font-mono text-neutral-400 ring-1 ring-neutral-700">
                {i + 1}
              </div>
              <div
                className={`flex-1 p-3 rounded-lg border text-sm ${colorMap[step.type]}`}
              >
                <span className="font-medium">{step.text}</span>
                {step.type === "decision" && (
                  <span className="text-xs text-neutral-500 ml-2 font-medium">
                    (Decision)
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
