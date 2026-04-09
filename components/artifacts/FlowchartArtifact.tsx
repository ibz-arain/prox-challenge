"use client";

import { useState } from "react";
import { GitBranch, ChevronRight } from "lucide-react";

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

export default function FlowchartArtifact({
  title,
  content,
}: FlowchartArtifactProps) {
  const steps = parseFlowchart(content);
  const [currentStep, setCurrentStep] = useState<string | null>(null);

  if (!steps) {
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

  const activeStep = currentStep
    ? steps.find((s) => s.id === currentStep)
    : null;

  const colorMap = {
    start: "border-[var(--color-accent)] bg-[var(--color-accent)]/10",
    decision: "border-[var(--color-warning)] bg-[var(--color-warning)]/10",
    action: "border-[var(--color-success)] bg-[var(--color-success)]/10",
    end: "border-[var(--color-text-muted)] bg-[var(--color-surface-2)]",
  };

  return (
    <div className="artifact-card my-4">
      <div className="artifact-card-header">
        <GitBranch size={14} />
        {title}
        {!currentStep && (
          <button
            onClick={() => setCurrentStep(steps[0]?.id ?? null)}
            className="ml-auto text-xs px-2 py-1 rounded bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors"
          >
            Start Interactive Mode
          </button>
        )}
        {currentStep && (
          <button
            onClick={() => setCurrentStep(null)}
            className="ml-auto text-xs px-2 py-1 rounded bg-[var(--color-surface-3)] text-[var(--color-text-muted)] hover:bg-[var(--color-border)] transition-colors"
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
                    onClick={() => setCurrentStep(activeStep.yes!)}
                    className="flex-1 px-4 py-2 rounded-lg bg-[var(--color-success)]/20 border border-[var(--color-success)] text-sm font-medium hover:bg-[var(--color-success)]/30 transition-colors"
                  >
                    Yes
                  </button>
                )}
                {activeStep.no && (
                  <button
                    onClick={() => setCurrentStep(activeStep.no!)}
                    className="flex-1 px-4 py-2 rounded-lg bg-[var(--color-danger)]/20 border border-[var(--color-danger)] text-sm font-medium hover:bg-[var(--color-danger)]/30 transition-colors"
                  >
                    No
                  </button>
                )}
              </div>
            )}
            {activeStep.next && (
              <button
                onClick={() => setCurrentStep(activeStep.next!)}
                className="w-full px-4 py-2 rounded-lg bg-[var(--color-surface-3)] border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-border)] transition-colors flex items-center justify-center gap-2"
              >
                Next <ChevronRight size={14} />
              </button>
            )}
            {activeStep.type === "end" && (
              <button
                onClick={() => setCurrentStep(steps[0]?.id ?? null)}
                className="w-full px-4 py-2 rounded-lg bg-[var(--color-accent)]/20 border border-[var(--color-accent)] text-sm font-medium hover:bg-[var(--color-accent)]/30 transition-colors"
              >
                Start Over
              </button>
            )}
          </div>
        ) : (
          steps.map((step, i) => (
            <div key={step.id} className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--color-surface-3)] flex items-center justify-center text-xs font-mono text-[var(--color-text-muted)]">
                {i + 1}
              </div>
              <div
                className={`flex-1 p-3 rounded-lg border text-sm ${colorMap[step.type]}`}
              >
                <span className="font-medium">{step.text}</span>
                {step.type === "decision" && (
                  <span className="text-xs text-[var(--color-text-muted)] ml-2">
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
