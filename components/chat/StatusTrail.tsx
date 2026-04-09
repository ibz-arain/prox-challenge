"use client";

interface StatusTrailProps {
  statuses: string[];
  hasTextStarted: boolean;
  isDone: boolean;
}

export default function StatusTrail({
  statuses,
  hasTextStarted,
  isDone,
}: StatusTrailProps) {
  if (statuses.length === 0) return null;

  const visibleStatuses = hasTextStarted ? statuses.slice(-1) : statuses;

  return (
    <div
      className={`status-trail overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/70 transition-all duration-400 ease-in-out ${
        hasTextStarted ? "max-h-10 opacity-60" : "max-h-[200px] opacity-100"
      } ${isDone ? "pointer-events-none opacity-0 transition-opacity duration-300" : ""}`}
    >
      <div className="px-3 py-2.5">
        <div className="space-y-1.5">
          {visibleStatuses.map((status, index) => {
            const actualIndex = hasTextStarted
              ? statuses.length - 1
              : index;
            const isActive = !isDone && actualIndex === statuses.length - 1;
            const isCompleted = actualIndex < statuses.length - 1 || isDone;
            return (
              <div
                key={`${status}-${actualIndex}`}
                className="flex translate-y-0 items-start gap-2 text-xs text-neutral-400 opacity-100 transition-all duration-150 ease-out"
              >
                <span
                  className={`mt-0.5 inline-flex h-3 w-3 shrink-0 items-center justify-center rounded-full border text-[10px] leading-none ${
                    isCompleted
                      ? "border-neutral-600 text-neutral-500"
                      : "border-brand/60 text-brand"
                  }`}
                  aria-hidden
                >
                  {isCompleted ? "✓" : ""}
                  {!isCompleted && (
                    <span className={`h-1.5 w-1.5 rounded-full bg-brand ${isActive ? "trail-pulse" : ""}`} />
                  )}
                </span>
                <span className={isCompleted ? "text-neutral-500" : "text-neutral-300"}>
                  {status}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <style jsx>{`
        .status-trail {
          transform: translateY(0);
        }
        .trail-pulse {
          animation: trailPulse 1.3s ease-in-out infinite;
        }
        @keyframes trailPulse {
          0% {
            opacity: 0.45;
            transform: scale(0.9);
          }
          50% {
            opacity: 1;
            transform: scale(1.05);
          }
          100% {
            opacity: 0.45;
            transform: scale(0.9);
          }
        }
      `}</style>
      <style jsx global>{`
        @media (prefers-reduced-motion: reduce) {
          * {
            transition-duration: 0.01ms !important;
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
