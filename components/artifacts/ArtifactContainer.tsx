"use client";

import { useEffect, useState } from "react";

interface ArtifactContainerProps {
  children: React.ReactNode;
}

export default function ArtifactContainer({ children }: ArtifactContainerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setMounted(true), 50);
    return () => window.clearTimeout(timeoutId);
  }, []);

  return (
    <div
      className={`transition-all duration-300 ease-out ${
        mounted ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      }`}
    >
      {children}
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
