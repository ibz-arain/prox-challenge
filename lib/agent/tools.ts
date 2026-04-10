import type Anthropic from "@anthropic-ai/sdk";
import { searchManual, getPageContent } from "../retrieval/search";
import { pageImageExists } from "../ingest/page-renderer";
import type { Citation, PageImage } from "../types";
import { SOURCE_LABELS } from "../types";
import { DIAGRAM_CATALOG, DIAGRAM_IDS } from "../diagrams/catalog";

const WELDING_QUERY_REWRITES: Array<[RegExp, string]> = [
  [/\bmig\b/gi, "MIG GMAW"],
  [/\bflux[- ]?cored\b/gi, "flux cored FCAW"],
  [/\btig\b/gi, "TIG GTAW"],
  [/\bstick\b/gi, "stick SMAW"],
  [/\bground clamp\b/gi, "work clamp ground clamp return lead"],
  [/\bpolarity\b/gi, "polarity DCEP DCEN lead connection"],
  [/\bporosity\b/gi, "porosity gas contamination shielding gas"],
];

function expandQuery(query: string): string {
  let expanded = query;
  for (const [pattern, replacement] of WELDING_QUERY_REWRITES) {
    expanded = expanded.replace(pattern, replacement);
  }
  return expanded;
}

function toCitation(
  source: string,
  sourceLabel: string,
  pageNumber: number,
  excerpt: string
): Citation {
  return {
    pageNumber,
    source,
    sourceLabel: SOURCE_LABELS[source] || sourceLabel,
    excerpt,
  };
}

async function searchManyQueries(
  queries: string[],
  options?: {
    sectionFilter?: string;
    sourceFilter?: string;
    topKPerQuery?: number;
    topK?: number;
  }
) {
  const results = await Promise.all(
    queries
      .map((query) => query.trim())
      .filter(Boolean)
      .map((query) =>
        searchManual(expandQuery(query), {
          sectionFilter: options?.sectionFilter,
          sourceFilter: options?.sourceFilter,
          topK: options?.topKPerQuery ?? 3,
        })
      )
  );

  const deduped = new Map<string, (typeof results)[number][number]>();
  for (const group of results) {
    for (const result of group) {
      const key = `${result.source}:${result.pageNumber}`;
      const existing = deduped.get(key);
      if (!existing || result.score > existing.score) {
        deduped.set(key, result);
      }
    }
  }

  return Array.from(deduped.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, options?.topK ?? 5);
}

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
    name: "search_manual_multi",
    description:
      "Search the manual with several focused queries in parallel, then merge and deduplicate the best pages. Use for ambiguous troubleshooting or when you need to cross-check multiple terms quickly.",
    input_schema: {
      type: "object" as const,
      properties: {
        queries: {
          type: "array",
          items: { type: "string" },
          description: "2-4 focused search queries to run together",
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
      required: ["queries"],
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
    name: "get_page_bundle",
    description:
      "Fetch the full text of multiple specific pages at once. Use when the answer depends on cross-referencing a few exact pages.",
    input_schema: {
      type: "object" as const,
      properties: {
        pages: {
          type: "array",
          items: { type: "number" },
          description: "A short list of page numbers to retrieve",
        },
        source: {
          type: "string",
          description:
            "Source document slug: 'owner-manual', 'quick-start-guide', or 'selection-chart'",
        },
      },
      required: ["pages"],
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
    name: "get_visual_context",
    description:
      "Find relevant visual/manual pages for a topic and attach page images for them. Use this when diagrams, photos, charts, or schematics are more helpful than prose.",
    input_schema: {
      type: "object" as const,
      properties: {
        topic: {
          type: "string",
          description:
            "The visual topic to look up, such as polarity, wire feed path, front panel, weld diagnosis, or settings chart",
        },
        source: {
          type: "string",
          description: "Optional source document slug",
        },
      },
      required: ["topic"],
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
      const results = await searchManual(expandQuery(query), { sectionFilter, topK: 5 });

      if (results.length === 0) {
        return {
          content:
            "No results found for this query. Try different search terms or a broader query.",
        };
      }

      const citations: Citation[] = results.map((r) =>
        toCitation(r.source, r.sourceLabel, r.pageNumber, r.excerpt)
      );

      const content = results
        .map(
          (r, i) =>
            `Result ${i + 1} [${SOURCE_LABELS[r.source] || r.sourceLabel}, Page ${r.pageNumber}] (score: ${r.score.toFixed(1)}):\n${r.excerpt}`
        )
        .join("\n\n");

      return { content, citations };
    }

    case "search_manual_multi": {
      const queries = Array.isArray(input.queries)
        ? input.queries.filter((item): item is string => typeof item === "string")
        : [];
      const sectionFilter = input.section_filter as string | undefined;
      const results = await searchManyQueries(queries, {
        sectionFilter,
        topKPerQuery: 3,
        topK: 6,
      });

      if (results.length === 0) {
        return {
          content: "No results found for those queries.",
        };
      }

      return {
        content: results
          .map(
            (r, index) =>
              `Result ${index + 1} [${SOURCE_LABELS[r.source] || r.sourceLabel}, Page ${r.pageNumber}] (score: ${r.score.toFixed(1)}):\n${r.excerpt}`
          )
          .join("\n\n"),
        citations: results.map((r) =>
          toCitation(r.source, r.sourceLabel, r.pageNumber, r.excerpt)
        ),
      };
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
          toCitation(
            page.source,
            page.sourceLabel,
            page.pageNumber,
            page.text.slice(0, 200) + "..."
          ),
        ],
      };
    }

    case "get_page_bundle": {
      const pages = Array.isArray(input.pages)
        ? input.pages.filter((page): page is number => typeof page === "number")
        : [];
      const source = input.source as string | undefined;
      const bundledPages = (
        await Promise.all(pages.map((pageNumber) => getPageContent(pageNumber, source)))
      ).filter((page): page is NonNullable<typeof page> => page !== null);

      if (bundledPages.length === 0) {
        return { content: "None of those pages were found." };
      }

      return {
        content: bundledPages
          .map(
            (page) =>
              `[${SOURCE_LABELS[page.source] || page.sourceLabel}, Page ${page.pageNumber}]:\n${page.text}`
          )
          .join("\n\n"),
        citations: bundledPages.map((page) =>
          toCitation(
            page.source,
            page.sourceLabel,
            page.pageNumber,
            page.text.slice(0, 200) + "..."
          )
        ),
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
        excerpt:
          excerpt && page
            ? `${excerpt}${page.text.length > 240 ? "..." : ""}`
            : "",
      };

      return {
        content: hasImage
          ? `Page image for ${SOURCE_LABELS[source] || source} page ${pageNumber} will be shown in the evidence panel.`
          : `Page image requested for ${SOURCE_LABELS[source] || source} page ${pageNumber}. (Image rendering may not be available — the page text is still accessible.)`,
        pageImages: [pageImage],
      };
    }

    case "get_visual_context": {
      const topic = String(input.topic ?? "").trim();
      const source = input.source as string | undefined;
      const results = await searchManyQueries(
        [
          topic,
          `${topic} diagram`,
          `${topic} chart`,
          `${topic} photo`,
          `${topic} schematic`,
        ],
        {
          sourceFilter: source,
          topKPerQuery: 2,
          topK: 4,
        }
      );

      if (results.length === 0) {
        return { content: `No visual references found for "${topic}".` };
      }

      const pageImages: PageImage[] = [];
      for (const result of results) {
        pageImages.push({
          pageNumber: result.pageNumber,
          source: result.source,
          sourceLabel: SOURCE_LABELS[result.source] || result.sourceLabel,
          url: `/api/pages/${result.source}/${result.pageNumber}`,
          excerpt: result.excerpt,
        });
      }

      return {
        content: results
          .map(
            (result) =>
              `Relevant visual [${SOURCE_LABELS[result.source] || result.sourceLabel}, Page ${result.pageNumber}]:\n${result.excerpt}`
          )
          .join("\n\n"),
        citations: results.map((result) =>
          toCitation(result.source, result.sourceLabel, result.pageNumber, result.excerpt)
        ),
        pageImages,
      };
    }

    case "lookup_specs": {
      const specType = input.spec_type as string;
      const query = SPEC_QUERIES[specType] || specType;
      const results = await searchManual(expandQuery(query), {
        sectionFilter: "specs",
        topK: 3,
      });

      if (results.length === 0) {
        const broaderResults = await searchManual(expandQuery(query), { topK: 3 });
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
          citations: broaderResults.map((r) =>
            toCitation(r.source, r.sourceLabel, r.pageNumber, r.excerpt)
          ),
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
        citations: results.map((r) =>
          toCitation(r.source, r.sourceLabel, r.pageNumber, r.excerpt)
        ),
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
