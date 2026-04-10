import type Anthropic from "@anthropic-ai/sdk";
import {
  getLlmClientAndModel,
  getLlmMaxOutputTokens,
} from "./client";
import { SYSTEM_PROMPT } from "./system-prompt";
import { toolDefinitions, executeToolCall } from "./tools";
import type { Citation, Artifact, PageImage, ChatMessage } from "../types";
import { normalizeAnthropicImageMediaType } from "../imageMime";
import { SOURCE_LABELS } from "../types";
import { SIDEBAR_SAMPLE_PROMPTS } from "../suggestionBank";

const MAX_TOOL_ROUNDS = 2;
const TOOL_TIMEOUT_MS = 12000;
const DEBUG_PREFIX = "[omni-agent]";

interface AgentResult {
  text: string;
  citations: Citation[];
  artifacts: Artifact[];
  pageImages: PageImage[];
}

interface RunAgentOptions {
  onStatus?: (message: string) => void | Promise<void>;
  onTextDelta?: (text: string) => void | Promise<void>;
  onCitation?: (citation: Citation) => void | Promise<void>;
  onArtifact?: (artifact: Artifact) => void | Promise<void>;
  onPageImage?: (pageImage: PageImage) => void | Promise<void>;
}

type CreateResponseOptions = {
  includeTools: boolean;
  streamText: boolean;
};

function parseArtifacts(text: string): {
  cleanText: string;
  artifacts: Artifact[];
} {
  const artifacts: Artifact[] = [];
  const artifactRegex =
    /<artifact\s+type="([^"]+)"\s+title="([^"]+)">([\s\S]*?)<\/artifact>/g;
  let match;

  while ((match = artifactRegex.exec(text)) !== null) {
    artifacts.push(normalizeArtifact({
      type: match[1] as Artifact["type"],
      title: match[2],
      content: match[3].trim(),
    }));
  }

  const cleanText = text.replace(artifactRegex, "").trim();
  return { cleanText, artifacts };
}

function buildFallbackAnswer(artifacts: Artifact[]): string {
  if (artifacts.length === 0) {
    return "I found the relevant manual pages, but the final answer did not format cleanly. Please try again.";
  }

  const firstArtifact = artifacts[0];
  switch (firstArtifact.type) {
    case "svg-diagram":
      return "Here is the exact setup with a diagram below.";
    case "flowchart":
      return "Here is the troubleshooting flow below.";
    case "settings-card":
      return "Here are the recommended settings below.";
    case "calculator":
      return "Here is the calculator below.";
    case "step-list":
      return "Here are the steps below.";
    case "table":
      return "Here are the exact numbers below.";
    default:
      return "Here is the answer below.";
  }
}

function logDebug(message: string, data?: Record<string, unknown>) {
  if (data) {
    console.log(DEBUG_PREFIX, message, data);
    return;
  }
  console.log(DEBUG_PREFIX, message);
}

function extractTextFromResponseContent(
  content: Anthropic.Messages.Message["content"]
): string {
  return content
    .filter((block): block is Extract<(typeof content)[number], { type: "text" }> => block.type === "text")
    .map((block) => block.text)
    .join("");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildCitationsTableArtifact(citations: Citation[]): Artifact {
  const header = "| Page | Source | Excerpt |\n|------|--------|---------|";
  const rows = citations.slice(0, 15).map((c) => {
    const excerpt = c.excerpt.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
    const short = excerpt.length > 120 ? `${excerpt.slice(0, 120)}...` : excerpt;
    return `| ${c.pageNumber} | ${c.sourceLabel.replace(/\|/g, "\\|")} | ${short} |`;
  });
  return {
    type: "table",
    title: "Manual sources used",
    content: [header, ...rows].join("\n"),
  };
}

function buildSuggestedPromptsArtifact(): Artifact {
  const items = SIDEBAR_SAMPLE_PROMPTS.map(
    (p) =>
      `<li data-artifact-query="${escapeHtml(p.query)}"><strong>${escapeHtml(p.label)}</strong> — ${escapeHtml(p.query)}</li>`
  ).join("");
  return {
    type: "artifact-html",
    title: "Try asking about the OmniPro 220",
    content: JSON.stringify({
      html: `<div class="wrap"><p class="lead">Example questions — click one to load it into the message box:</p><ul class="list" data-suggestions>${items}</ul></div>`,
      css: `.wrap{font-family:system-ui,-apple-system,sans-serif;padding:12px;color:#e5e7eb}.lead{color:#9ca3af;font-size:12px;margin:0 0 10px}.list{margin:0;padding-left:18px;font-size:13px;line-height:1.55}.list li{margin:8px 0}`,
      height: 420,
      suggestions: SIDEBAR_SAMPLE_PROMPTS.map((p) => ({
        label: p.label,
        query: p.query,
      })),
    }),
  };
}

function ensureArtifacts(
  artifacts: Artifact[],
  citations: Citation[]
): { artifacts: Artifact[]; injected: string[] } {
  const out = [...artifacts];
  const injected: string[] = [];

  if (out.length === 0) {
    if (citations.length > 0) {
      out.push(buildCitationsTableArtifact(citations));
      injected.push("citations-table");
    } else {
      out.push(buildSuggestedPromptsArtifact());
      injected.push("suggested-prompts");
    }
  }

  return { artifacts: out, injected };
}

function normalizeArtifact(artifact: Artifact): Artifact {
  const trimmedContent = artifact.content.trim();

  if (artifact.type === "calculator") {
    try {
      JSON.parse(trimmedContent);
    } catch {
      if (trimmedContent.startsWith("<")) {
        return {
          type: "artifact-html",
          title: artifact.title,
          content: JSON.stringify({
            html: trimmedContent,
            height: 420,
          }),
        };
      }
    }
  }

  if (artifact.type === "artifact-html") {
    try {
      JSON.parse(trimmedContent);
    } catch {
      if (trimmedContent.startsWith("<")) {
        return {
          ...artifact,
          content: JSON.stringify({
            html: trimmedContent,
            height: 420,
          }),
        };
      }
    }
  }

  return artifact;
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  onTimeout: () => T
): Promise<T> {
  return await new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => resolve(onTimeout()), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

export async function runAgent(
  messages: ChatMessage[],
  options: RunAgentOptions = {}
): Promise<AgentResult> {
  const { onStatus, onTextDelta, onCitation, onArtifact, onPageImage } = options;
  const { client, model } = getLlmClientAndModel();
  const maxTokens = getLlmMaxOutputTokens();
  const latestUserMessage =
    [...messages].reverse().find((message) => message.role === "user")?.content ?? "";

  const anthropicMessages: Anthropic.Messages.MessageParam[] = messages.map(
    (m) => {
      if (m.role === "user" && m.image) {
        const media_type = normalizeAnthropicImageMediaType(
          m.imageMimeType,
          m.image
        );
        return {
          role: "user" as const,
          content: [
            {
              type: "image" as const,
              source: {
                type: "base64" as const,
                media_type,
                data: m.image,
              },
            },
            { type: "text" as const, text: m.content },
          ],
        };
      }
      return {
        role: m.role as "user" | "assistant",
        content: m.content,
      };
    }
  );

  const allCitations: Citation[] = [];
  const allPageImages: PageImage[] = [];
  let fullText = "";
  const seenCitationKeys = new Set<string>();
  const seenPageImageKeys = new Set<string>();

  logDebug("run started", {
    messageCount: messages.length,
    latestUserPreview: latestUserMessage.slice(0, 160),
  });

  const streamAssistantResponse = async (
    activeClient: Anthropic,
    activeModel: string,
    requestOptions: CreateResponseOptions
  ) => {
    const params: {
      model: string;
      max_tokens: number;
      system: string;
      messages: Anthropic.Messages.MessageParam[];
      tools?: Anthropic.Messages.Tool[];
    } = {
      model: activeModel,
      max_tokens: maxTokens,
      system: SYSTEM_PROMPT,
      messages: anthropicMessages,
    };
    if (requestOptions.includeTools) {
      params.tools = toolDefinitions;
    }

    const messagesApi = activeClient.messages;
    const streamFn = messagesApi.stream as
      | ((request: typeof params) => {
          on: (event: "text", cb: (deltaText: string) => void) => void;
          finalMessage: () => Promise<Anthropic.Messages.Message>;
        })
      | undefined;

    // Must call as messagesApi.stream(params) so `this` stays bound; detached calls break
    // MessageStream.createMessage(this, ...) and yield "reading 'create'" on undefined.
    if (requestOptions.streamText && typeof streamFn === "function") {
      const messageStream = streamFn.call(messagesApi, params);
      let textSendChain: Promise<void> = Promise.resolve();
      if (onTextDelta) {
        messageStream.on("text", (deltaText: string) => {
          textSendChain = textSendChain.then(() =>
            Promise.resolve(onTextDelta(deltaText)).then(() => undefined)
          );
        });
      }
      const final = await messageStream.finalMessage();
      await textSendChain;
      return final;
    }

    return await messagesApi.create(params);
  };

  const createAssistantResponse = async (requestOptions: CreateResponseOptions) =>
    await streamAssistantResponse(client, model, requestOptions);

  const recoverPlainTextAnswer = async () => {
    logDebug("plain-text recovery started");
    const recovery = await client.messages.create({
      model,
      max_tokens: Math.min(maxTokens, 300),
      system: `${SYSTEM_PROMPT}

## Recovery Mode
- Use only the evidence already gathered.
- Reply with plain text only.
- No artifact tags.
- No HTML.
- No tables.
- Keep it to 1-2 short sentences.`,
      messages: [
        ...anthropicMessages,
        {
          role: "user",
          content:
            "Restate the final answer in plain text only using the evidence already gathered. No artifact tags.",
        },
      ],
    });

    const recoveryText = extractTextFromResponseContent(recovery.content).trim();
    logDebug("plain-text recovery finished", {
      textLength: recoveryText.length,
    });
    return recoveryText;
  };

  const getToolStatusMessage = (
    toolName: string,
    toolInput: Record<string, unknown>
  ): string | null => {
    switch (toolName) {
      case "search_manual": {
        const query = String(toolInput.query ?? "query");
        return `Searching for "${query}"...`;
      }
      case "search_manual_multi": {
        return "Cross-checking a few manual searches...";
      }
      case "get_page": {
        const pageNumber = Number(toolInput.page_number ?? 0);
        const source = String(toolInput.source ?? "owner-manual");
        const sourceLabel = SOURCE_LABELS[source] ?? source;
        return `Reading ${sourceLabel} page ${pageNumber}...`;
      }
      case "get_page_bundle": {
        const pages = Array.isArray(toolInput.pages)
          ? toolInput.pages.join(", ")
          : "requested pages";
        return `Cross-referencing pages ${pages}...`;
      }
      case "get_page_image": {
        const pageNumber = Number(toolInput.page_number ?? 0);
        return `Pulling the visual from page ${pageNumber}...`;
      }
      case "get_visual_context": {
        const topic = String(toolInput.topic ?? "requested topic");
        return `Finding the best visual for ${topic}...`;
      }
      case "get_diagram": {
        const diagramName = String(toolInput.diagram_id ?? "requested");
        return `Loading the ${diagramName} diagram...`;
      }
      case "lookup_specs": {
        const query = String(toolInput.spec_type ?? "requested");
        return `Looking up ${query} specs...`;
      }
      default:
        return null;
    }
  };

  const getToolCompleteStatusMessage = (
    toolName: string,
    toolInput: Record<string, unknown>,
    result: Awaited<ReturnType<typeof executeToolCall>>
  ): string | null => {
    switch (toolName) {
      case "search_manual":
      case "search_manual_multi": {
        const citations = result.citations ?? [];
        if (!citations.length) {
          return "No strong matches yet.";
        }
        const topPage = citations[0]?.pageNumber ?? 1;
        return `Found ${citations.length} useful page${citations.length === 1 ? "" : "s"}; top hit is page ${topPage}.`;
      }
      case "get_page": {
        const pageNumber = Number(toolInput.page_number ?? 0);
        return Number.isFinite(pageNumber) && pageNumber > 0
          ? `Read page ${pageNumber}.`
          : "Read the page.";
      }
      case "get_page_bundle": {
        const pages = Array.isArray(toolInput.pages)
          ? toolInput.pages.filter((page): page is number => typeof page === "number")
          : [];
        if (pages.length === 0) {
          return "Read the requested pages.";
        }
        return `Read pages ${pages.join(", ")}.`;
      }
      case "get_page_image": {
        const pageNumber = Number(toolInput.page_number ?? 0);
        return Number.isFinite(pageNumber) && pageNumber > 0
          ? `Pulled the page ${pageNumber} visual.`
          : "Pulled the visual.";
      }
      case "get_visual_context": {
        const pageImages = result.pageImages ?? [];
        if (pageImages.length > 0) {
          return `Found ${pageImages.length} relevant visual${pageImages.length === 1 ? "" : "s"}.`;
        }
        return "Found the relevant visuals.";
      }
      case "get_diagram": {
        const diagramId = String(toolInput.diagram_id ?? "requested");
        return `Got the ${diagramId} diagram.`;
      }
      case "lookup_specs": {
        const specType = String(toolInput.spec_type ?? "requested");
        return `Found the ${specType} specs.`;
      }
      default:
        return null;
    }
  };

  const emitCitation = async (citation: Citation) => {
    const key = `${citation.source}:${citation.pageNumber}`;
    if (seenCitationKeys.has(key)) return;
    seenCitationKeys.add(key);
    allCitations.push(citation);
    if (onCitation) {
      await onCitation(citation);
    }
  };

  const emitPageImage = async (pageImage: PageImage) => {
    const key = `${pageImage.source}:${pageImage.pageNumber}`;
    if (seenPageImageKeys.has(key)) return;
    seenPageImageKeys.add(key);
    allPageImages.push(pageImage);
    if (onPageImage) {
      await onPageImage(pageImage);
    }
  };

  if (onStatus) {
    const hasUserImage = messages.some((m) => m.role === "user" && m.image);
    await onStatus(
      hasUserImage
        ? "Looking at your image and the manual..."
        : "Checking the manual..."
    );
  }

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    if (onStatus && round > 0) {
      await onStatus(round === 1 ? "Double-checking a few details..." : "One more look...");
    }
    const response = await createAssistantResponse({
      includeTools: true,
      streamText: false,
    });

    const toolUseBlocks: Anthropic.Messages.ToolUseBlock[] = [];

    for (const block of response.content) {
      if (block.type === "tool_use") {
        toolUseBlocks.push(block);
      }
    }

    if (toolUseBlocks.length === 0) {
      logDebug("no tool calls requested", { round: round + 1 });
      break;
    }

    anthropicMessages.push({
      role: "assistant",
      content: response.content,
    });

    const toolResults = await Promise.all(
      toolUseBlocks.map(async (toolUse) => {
        const input = toolUse.input as Record<string, unknown>;
        logDebug("tool start", {
          round: round + 1,
          tool: toolUse.name,
          input,
        });
        const statusMessage = getToolStatusMessage(toolUse.name, input);
        if (statusMessage && onStatus) {
          await onStatus(statusMessage);
        }
        const result = await withTimeout(
          executeToolCall(toolUse.name, input),
          TOOL_TIMEOUT_MS,
          () => ({
            content:
              "This lookup timed out. Continue with the other evidence and say the result may be incomplete.",
            citations: [],
            pageImages: [],
          })
        );
        const completeStatus = getToolCompleteStatusMessage(toolUse.name, input, result);
        logDebug("tool complete", {
          round: round + 1,
          tool: toolUse.name,
          citations: result.citations?.length ?? 0,
          pageImages: result.pageImages?.length ?? 0,
          contentPreview: result.content.slice(0, 160),
        });
        if (completeStatus && onStatus) {
          await onStatus(completeStatus);
        }

        if (result.citations) {
          for (const citation of result.citations) {
            await emitCitation(citation);
          }
        }
        if (result.pageImages) {
          for (const pageImage of result.pageImages) {
            await emitPageImage(pageImage);
          }
        }

        return {
          type: "tool_result" as const,
          tool_use_id: toolUse.id,
          content: result.content,
        };
      })
    );

    anthropicMessages.push({
      role: "user",
      content: toolResults,
    });
  }

  if (onStatus) {
    await onStatus("Putting it together...");
  }
  const finalResponse = await createAssistantResponse({
    includeTools: false,
    streamText: true,
  });
  fullText += extractTextFromResponseContent(finalResponse.content);

  const { cleanText, artifacts } = parseArtifacts(fullText);
  logDebug("final response parsed", {
    rawTextLength: fullText.length,
    cleanTextLength: cleanText.length,
    artifactCount: artifacts.length,
    artifactTypes: artifacts.map((artifact) => artifact.type),
  });

  let finalText = cleanText;
  if (!finalText) {
    try {
      finalText = await recoverPlainTextAnswer();
    } catch (error) {
      console.error(DEBUG_PREFIX, "plain-text recovery failed", error);
    }
  }

  finalText = finalText || buildFallbackAnswer(artifacts);
  logDebug("final text ready", {
    source:
      cleanText.length > 0
        ? "primary"
        : finalText.startsWith("I found the relevant manual pages")
          ? "fallback"
          : "recovery",
    textLength: finalText.length,
  });

  const ensured = ensureArtifacts(artifacts, allCitations);
  if (ensured.injected.length > 0) {
    logDebug("artifacts synthesized", {
      injected: ensured.injected,
      finalCount: ensured.artifacts.length,
    });
  }

  if (onArtifact) {
    for (const artifact of ensured.artifacts) {
      await onArtifact(artifact);
    }
  }

  return {
    text: finalText,
    citations: allCitations,
    artifacts: ensured.artifacts,
    pageImages: allPageImages,
  };
}
