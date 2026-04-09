import type Anthropic from "@anthropic-ai/sdk";
import { searchManual, getPageContent } from "../retrieval/search";
import { pageImageExists } from "../ingest/page-renderer";
import type { Citation, PageImage } from "../types";
import { SOURCE_LABELS } from "../types";
import { DIAGRAM_CATALOG, DIAGRAM_IDS } from "../diagrams/catalog";

export const toolDefinitions: Anthropic.Messages.Tool[] = [
  {
    name: "search_manual",
    description:
      "Search the OmniPro 220 manuals for relevant content. Returns ranked results with page numbers and text excerpts. Use this as your primary way to find information.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            "Search query — use specific technical terms, part names, or describe what you're looking for",
        },
        section_filter: {
          type: "string",
          enum: [
            "safety",
            "setup",
            "specs",
            "troubleshooting",
            "polarity",
            "welding-process",
            "maintenance",
            "parts",
            "general",
          ],
          description: "Optional: filter results to a specific manual section",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_page",
    description:
      "Get the full text content of a specific manual page. Use when you need complete context from a page referenced in search results.",
    input_schema: {
      type: "object" as const,
      properties: {
        page_number: {
          type: "number",
          description: "The page number to retrieve",
        },
        source: {
          type: "string",
          description:
            "Source document slug: 'owner-manual', 'quick-start-guide', or 'selection-chart'",
        },
      },
      required: ["page_number"],
    },
  },
  {
    name: "get_page_image",
    description:
      "Request that a manual page image be shown in the evidence panel. Use when the visual content of a page (diagram, chart, photo, schematic) is relevant to the answer.",
    input_schema: {
      type: "object" as const,
      properties: {
        page_number: {
          type: "number",
          description: "The page number to show",
        },
        source: {
          type: "string",
          description: "Source document slug",
        },
      },
      required: ["page_number"],
    },
  },
  {
    name: "get_diagram",
    description:
      "Return a canonical SVG diagram for common polarity/connection questions. Use this before generating custom SVG for these known scenarios.",
    input_schema: {
      type: "object" as const,
      properties: {
        diagram_id: {
          type: "string",
          enum: DIAGRAM_IDS,
          description: "Canonical diagram identifier",
        },
      },
      required: ["diagram_id"],
    },
  },
  {
    name: "lookup_specs",
    description:
      "Look up specific technical specifications for the OmniPro 220. Searches spec-related pages with targeted queries.",
    input_schema: {
      type: "object" as const,
      properties: {
        spec_type: {
          type: "string",
          enum: [
            "duty-cycle",
            "voltage-range",
            "amperage-range",
            "wire-specs",
            "gas-specs",
            "dimensions-weight",
            "input-power",
          ],
          description: "The type of specification to look up",
        },
      },
      required: ["spec_type"],
    },
  },
];

const SPEC_QUERIES: Record<string, string> = {
  "duty-cycle": "duty cycle percentage amperage",
  "voltage-range": "output voltage range",
  "amperage-range": "amperage range output current",
  "wire-specs": "wire diameter size feed speed",
  "gas-specs": "shielding gas flow rate argon CO2",
  "dimensions-weight": "dimensions weight specifications",
  "input-power": "input voltage power requirements 120V 240V",
};

export interface ToolResult {
  content: string;
  citations?: Citation[];
  pageImages?: PageImage[];
}

export async function executeToolCall(
  name: string,
  input: Record<string, unknown>
): Promise<ToolResult> {
  switch (name) {
    case "search_manual": {
      const query = input.query as string;
      const sectionFilter = input.section_filter as string | undefined;
      const results = await searchManual(query, { sectionFilter, topK: 5 });

      if (results.length === 0) {
        return {
          content:
            "No results found for this query. Try different search terms or a broader query.",
        };
      }

      const citations: Citation[] = results.map((r) => ({
        pageNumber: r.pageNumber,
        source: r.source,
        sourceLabel: SOURCE_LABELS[r.source] || r.sourceLabel,
        excerpt: r.excerpt,
      }));

      const content = results
        .map(
          (r, i) =>
            `Result ${i + 1} [${SOURCE_LABELS[r.source] || r.sourceLabel}, Page ${r.pageNumber}] (score: ${r.score.toFixed(1)}):\n${r.excerpt}`
        )
        .join("\n\n");

      return { content, citations };
    }

    case "get_page": {
      const pageNumber = input.page_number as number;
      const source = input.source as string | undefined;
      const page = await getPageContent(pageNumber, source);

      if (!page) {
        return { content: `Page ${pageNumber} not found.` };
      }

      return {
        content: `[${SOURCE_LABELS[page.source] || page.sourceLabel}, Page ${page.pageNumber}]:\n${page.text}`,
        citations: [
          {
            pageNumber: page.pageNumber,
            source: page.source,
            sourceLabel: SOURCE_LABELS[page.source] || page.sourceLabel,
            excerpt: page.text.slice(0, 200) + "...",
          },
        ],
      };
    }

    case "get_page_image": {
      const pageNumber = input.page_number as number;
      const source = (input.source as string) || "owner-manual";
      const hasImage = pageImageExists(source, pageNumber);
      const page = await getPageContent(pageNumber, source);
      const excerpt = page?.text?.slice(0, 240);

      const pageImage: PageImage = {
        pageNumber,
        source,
        sourceLabel: SOURCE_LABELS[source] || source,
        url: `/api/pages/${source}/${pageNumber}`,
        excerpt: excerpt ? `${excerpt}${page.text.length > 240 ? "..." : ""}` : "",
      };

      return {
        content: hasImage
          ? `Page image for ${SOURCE_LABELS[source] || source} page ${pageNumber} will be shown in the evidence panel.`
          : `Page image requested for ${SOURCE_LABELS[source] || source} page ${pageNumber}. (Image rendering may not be available — the page text is still accessible.)`,
        pageImages: [pageImage],
      };
    }

    case "lookup_specs": {
      const specType = input.spec_type as string;
      const query = SPEC_QUERIES[specType] || specType;
      const results = await searchManual(query, {
        sectionFilter: "specs",
        topK: 3,
      });

      if (results.length === 0) {
        const broaderResults = await searchManual(query, { topK: 3 });
        if (broaderResults.length === 0) {
          return {
            content: `No specification data found for "${specType}". Try searching with different terms.`,
          };
        }
        const content = broaderResults
          .map(
            (r) =>
              `[${SOURCE_LABELS[r.source] || r.sourceLabel}, Page ${r.pageNumber}]:\n${r.excerpt}`
          )
          .join("\n\n");
        return {
          content,
          citations: broaderResults.map((r) => ({
            pageNumber: r.pageNumber,
            source: r.source,
            sourceLabel: SOURCE_LABELS[r.source] || r.sourceLabel,
            excerpt: r.excerpt,
          })),
        };
      }

      const content = results
        .map(
          (r) =>
            `[${SOURCE_LABELS[r.source] || r.sourceLabel}, Page ${r.pageNumber}]:\n${r.excerpt}`
        )
        .join("\n\n");

      return {
        content,
        citations: results.map((r) => ({
          pageNumber: r.pageNumber,
          source: r.source,
          sourceLabel: SOURCE_LABELS[r.source] || r.sourceLabel,
          excerpt: r.excerpt,
        })),
      };
    }

    case "get_diagram": {
      const diagramId = input.diagram_id as string;
      const svg = DIAGRAM_CATALOG[diagramId];
      if (!svg) {
        return {
          content: `Unknown diagram_id "${diagramId}". Available IDs: ${DIAGRAM_IDS.join(", ")}`,
        };
      }

      return {
        content: `Canonical diagram "${diagramId}" SVG:\n${svg}\n\nUse this SVG directly inside an <artifact type="svg-diagram"> block.`,
      };
    }

    default:
      return { content: `Unknown tool: ${name}` };
  }
}
