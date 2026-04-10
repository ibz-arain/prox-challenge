"use client";

interface ArtifactContainerProps {
  children: React.ReactNode;
}

export default function ArtifactContainer({ children }: ArtifactContainerProps) {
  return (
    <div className="motion-safe:animate-[chat-artifact-in_0.48s_cubic-bezier(0.22,1,0.36,1)_both] motion-reduce:animate-none">
      {children}
    </div>
  );
}
