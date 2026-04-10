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
import {
  injectCanonicalDiagramIfMissing,
  injectTroubleshootingMermaidIfMissing,
} from "../inferDiagramFromContext";

const MAX_TOOL_ROUNDS = 2;
/** Per-tool ceiling. First request on Vercel can spend 20–40s+ building the PDF index; 12s falsely looked like "manual timed out". Keep below `maxDuration` in app/api/chat/route.ts (60s). */
const TOOL_TIMEOUT_MS = Number(process.env.TOOL_TIMEOUT_MS) || 50000;
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

const ARTIFACT_TYPE_FIRST =
  /<artifact\s+type\s*=\s*["']([^"']+)["']\s+title\s*=\s*["']([^"']+)["']\s*>([\s\S]*?)<\/artifact>/gi;
const ARTIFACT_TITLE_FIRST =
  /<artifact\s+title\s*=\s*["']([^"']+)["']\s+type\s*=\s*["']([^"']+)["']\s*>([\s\S]*?)<\/artifact>/gi;

function parseArtifacts(text: string): {
  cleanText: string;
  artifacts: Artifact[];
} {
  const artifacts: Artifact[] = [];
  const seen = new Set<string>();

  const pushArtifact = (type: string, title: string, body: string) => {
    const key = `${type}\0${title}\0${body.slice(0, 200)}`;
    if (seen.has(key)) return;
    seen.add(key);
    artifacts.push(
      normalizeArtifact({
        type: type as Artifact["type"],
        title,
        content: body.trim(),
      })
    );
  };

  let m: RegExpExecArray | null;
  const reType = new RegExp(ARTIFACT_TYPE_FIRST.source, ARTIFACT_TYPE_FIRST.flags);
  while ((m = reType.exec(text)) !== null) {
    pushArtifact(m[1], m[2], m[3]);
  }
  const reTitle = new RegExp(ARTIFACT_TITLE_FIRST.source, ARTIFACT_TITLE_FIRST.flags);
  while ((m = reTitle.exec(text)) !== null) {
    pushArtifact(m[2], m[1], m[3]);
  }

  const cleanText = text
    .replace(new RegExp(ARTIFACT_TYPE_FIRST.source, ARTIFACT_TYPE_FIRST.flags), "")
    .replace(new RegExp(ARTIFACT_TITLE_FIRST.source, ARTIFACT_TITLE_FIRST.flags), "")
    .trim();
  return { cleanText, artifacts };
}

function normalizeFinalText(text: string): string {
  return text.replace(/[\u200b\u200c\u200d\ufeff]/g, "").trim();
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
    case "mermaid":
      return "Here is the diagram below.";
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
              "This tool step exceeded the server time limit (often first-time PDF indexing on a cold server). Do not claim the manual is missing. Say the user should retry once—after that, retrieval is usually fast—and keep any citations you already have.",
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
  const diagramInjection = injectCanonicalDiagramIfMissing(
    artifacts,
    latestUserMessage,
    cleanText
  );
  let mergedArtifacts = diagramInjection.artifacts;
  if (diagramInjection.injectedId) {
    logDebug("canonical diagram injected (model omitted visual artifact)", {
      diagramId: diagramInjection.injectedId,
    });
  }
  const troubleInjection = injectTroubleshootingMermaidIfMissing(
    mergedArtifacts,
    latestUserMessage,
    cleanText
  );
  mergedArtifacts = troubleInjection.artifacts;
  if (troubleInjection.injected) {
    logDebug("troubleshooting mermaid injected (model omitted visual artifact)", {});
  }
  logDebug("final response parsed", {
    rawTextLength: fullText.length,
    cleanTextLength: cleanText.length,
    artifactCount: mergedArtifacts.length,
    artifactTypes: mergedArtifacts.map((artifact) => artifact.type),
  });

  let finalText = normalizeFinalText(cleanText);
  if (!finalText) {
    try {
      finalText = normalizeFinalText(await recoverPlainTextAnswer());
    } catch (error) {
      console.error(DEBUG_PREFIX, "plain-text recovery failed", error);
    }
  }

  finalText = normalizeFinalText(finalText || buildFallbackAnswer(mergedArtifacts));
  if (!finalText) {
    finalText = buildFallbackAnswer(mergedArtifacts);
  }
  logDebug("final text ready", {
    source:
      cleanText.length > 0
        ? "primary"
        : finalText.startsWith("I found the relevant manual pages")
          ? "fallback"
          : "recovery",
    textLength: finalText.length,
  });

  if (onArtifact) {
    for (const artifact of mergedArtifacts) {
      await onArtifact(artifact);
    }
  }

  return {
    text: finalText,
    citations: allCitations,
    artifacts: mergedArtifacts,
    pageImages: allPageImages,
  };
}
