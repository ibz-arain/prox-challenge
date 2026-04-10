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
  type:
    | "table"
    | "svg-diagram"
    | "flowchart"
    | "calculator"
    | "settings-card"
    | "artifact-html";
  title: string;
  content: string;
}

export interface PageImage {
  pageNumber: number;
  source: string;
  sourceLabel: string;
  url: string;
  imageUrl?: string;
  excerpt?: string;
}

export interface SelectedSource {
  sourceId: string;
  messageId: string;
  citation: Citation;
  pageImage?: PageImage;
}

export interface ChatMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
  image?: string;
  citations?: Citation[];
  artifacts?: Artifact[];
  pageImages?: PageImage[];
}

export interface StreamEvent {
  type:
    | "text_delta"
    | "text_replace"
    | "status"
    | "citation"
    | "artifact"
    | "page_image"
    | "heartbeat"
    | "done"
    | "error";
  delta?: string;
  text?: string;
  message?: string;
  data?: Citation | Artifact | PageImage;
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
