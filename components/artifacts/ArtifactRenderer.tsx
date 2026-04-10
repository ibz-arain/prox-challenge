"use client";

import type { Artifact } from "@/lib/types";
import TableArtifact from "./TableArtifact";
import DiagramArtifact from "./DiagramArtifact";
import FlowchartArtifact from "./FlowchartArtifact";
import CalculatorWidget from "./CalculatorWidget";
import SettingsCard from "./SettingsCard";
import HtmlArtifact from "./HtmlArtifact";
import StepListArtifact from "./StepListArtifact";

interface ArtifactRendererProps {
  artifact: Artifact;
  onFillComposer?: (text: string) => void;
}

export default function ArtifactRenderer({
  artifact,
  onFillComposer,
}: ArtifactRendererProps) {
  switch (artifact.type) {
    case "table":
      return <TableArtifact title={artifact.title} content={artifact.content} />;
    case "svg-diagram":
      return (
        <DiagramArtifact title={artifact.title} content={artifact.content} />
      );
    case "flowchart":
      return (
        <FlowchartArtifact title={artifact.title} content={artifact.content} />
      );
    case "calculator":
      return (
        <CalculatorWidget title={artifact.title} content={artifact.content} />
      );
    case "settings-card":
      return <SettingsCard title={artifact.title} content={artifact.content} />;
    case "step-list":
      return (
        <StepListArtifact title={artifact.title} content={artifact.content} />
      );
    case "artifact-html":
      return (
        <HtmlArtifact
          title={artifact.title}
          content={artifact.content}
          onFillComposer={onFillComposer}
        />
      );
    default:
      return (
        <div className="artifact-card my-4">
          <div className="artifact-card-header">Unknown artifact type</div>
          <div className="p-4 text-sm">{artifact.content}</div>
        </div>
      );
  }
}
