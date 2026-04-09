"use client";

import { Zap } from "lucide-react";

const WELCOME_CHIPS = [
  "Duty cycle for MIG at 200A on 240V?",
  "Porosity in my flux-cored welds",
  "TIG polarity setup",
  "Which socket for ground clamp?",
  "Settings for 1/8\" mild steel",
  "120V vs 240V differences",
];

interface WelcomeStateProps {
  onSelectPrompt: (prompt: string) => void;
  disabled?: boolean;
}

export default function WelcomeState({
  onSelectPrompt,
  disabled = false,
}: WelcomeStateProps) {
  return (
    <div className="flex min-h-[55vh] flex-col items-center justify-center px-4 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand/15 ring-1 ring-brand/25">
        <Zap size={18} className="text-brand" strokeWidth={2} />
      </div>
      <h2 className="text-xl font-semibold text-neutral-100">OmniPro 220</h2>
      <p className="mt-1 text-sm text-neutral-400">
        Ask anything about setup, troubleshooting, and welding specs.
      </p>
      <div className="mt-6 grid w-full max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2">
        {WELCOME_CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            disabled={disabled}
            onClick={() => onSelectPrompt(chip)}
            className="rounded-xl border border-neutral-800 bg-neutral-900/50 px-3 py-2 text-left text-sm text-neutral-300 transition-colors duration-150 ease-out hover:border-brand/45 hover:text-brand-hover focus:outline-none focus-visible:ring-1 focus-visible:ring-brand/35 disabled:opacity-50"
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
}
