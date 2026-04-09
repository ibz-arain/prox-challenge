export interface PageData {
  id: string;
  pageNumber: number;
  source: string;
  sourceLabel: string;
  text: string;
  section: string;
  contentType: "text" | "table" | "diagram" | "mixed";
  extractedViaVision?: boolean;
  extractionMethod?: "text" | "vision";
}

export interface SearchResult {
  id: string;
  pageNumber: number;
  source: string;
  sourceLabel: string;
  text: string;
  section: string;
  score: number;
  excerpt: string;
}

export interface Citation {
  pageNumber: number;
  source: string;
  sourceLabel: string;
  excerpt: string;
}

export interface Artifact {
  type: "table" | "svg-diagram" | "flowchart" | "calculator" | "settings-card";
  title: string;
  content: string;
}

export interface PageImage {
  pageNumber: number;
  source: string;
  sourceLabel: string;
  url: string;
  excerpt?: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  image?: string;
  citations?: Citation[];
  artifacts?: Artifact[];
  pageImages?: PageImage[];
}

export interface StreamEvent {
  type:
    | "text"
    | "status"
    | "citations"
    | "artifacts"
    | "pageImages"
    | "done"
    | "error";
  delta?: string;
  stage?: "searching" | "generating";
  data?: unknown;
  error?: string;
}

export interface IngestStatus {
  ready: boolean;
  totalPages: number;
  sources: string[];
  indexedAt?: string;
}

export const SOURCE_LABELS: Record<string, string> = {
  "owner-manual": "Owner's Manual",
  "quick-start-guide": "Quick Start Guide",
  "selection-chart": "Selection Chart",
};
