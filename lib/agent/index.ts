import type Anthropic from "@anthropic-ai/sdk";
import {
  getLlmClientAndModel,
  getLlmMaxOutputTokens,
} from "./client";
import { SYSTEM_PROMPT } from "./system-prompt";
import { toolDefinitions, executeToolCall } from "./tools";
import type { Citation, Artifact, PageImage, ChatMessage } from "../types";
import { SOURCE_LABELS } from "../types";

const MAX_TOOL_ROUNDS = 3;
const TOOL_TIMEOUT_MS = 12000;

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
    artifacts.push({
      type: match[1] as Artifact["type"],
      title: match[2],
      content: match[3].trim(),
    });
  }

  const cleanText = text.replace(artifactRegex, "").trim();
  return { cleanText, artifacts };
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

  const anthropicMessages: Anthropic.Messages.MessageParam[] = messages.map(
    (m) => {
      if (m.role === "user" && m.image) {
        return {
          role: "user" as const,
          content: [
            {
              type: "image" as const,
              source: {
                type: "base64" as const,
                media_type: "image/jpeg" as const,
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
      if (onTextDelta) {
        messageStream.on("text", (deltaText: string) => {
          void onTextDelta(deltaText);
        });
      }
      return await messageStream.finalMessage();
    }

    return await messagesApi.create(params);
  };

  const createAssistantResponse = async (requestOptions: CreateResponseOptions) =>
    await streamAssistantResponse(client, model, requestOptions);

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
    result: Awaited<ReturnType<typeof executeToolCall>>
  ): string | null => {
    if (toolName !== "search_manual" && toolName !== "search_manual_multi") {
      return null;
    }
    const citations = result.citations ?? [];
    if (!citations.length) {
      return "No strong matches yet.";
    }
    const topPage = citations[0]?.pageNumber ?? 1;
    return `Found ${citations.length} useful page${citations.length === 1 ? "" : "s"}; top hit is page ${topPage}.`;
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
    await onStatus("Checking the manual...");
  }

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    if (onStatus && round > 0) {
      await onStatus(`Reviewing the evidence pass ${round + 1}/${MAX_TOOL_ROUNDS}...`);
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
      break;
    }

    anthropicMessages.push({
      role: "assistant",
      content: response.content,
    });

    const toolResults = await Promise.all(
      toolUseBlocks.map(async (toolUse) => {
        const input = toolUse.input as Record<string, unknown>;
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
        if (onStatus) {
          await onStatus(`Finished ${toolUse.name.replaceAll("_", " ")}.`);
        }
        const completeStatus = getToolCompleteStatusMessage(toolUse.name, result);
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
    await onStatus("Writing the answer...");
  }
  const finalResponse = await createAssistantResponse({
    includeTools: false,
    streamText: true,
  });
  const finalTextBlocks: string[] = [];
  for (const block of finalResponse.content) {
    if (block.type === "text") {
      finalTextBlocks.push(block.text);
    }
  }
  fullText += finalTextBlocks.join("");

  const { cleanText, artifacts } = parseArtifacts(fullText);
  if (onArtifact) {
    for (const artifact of artifacts) {
      await onArtifact(artifact);
    }
  }

  return {
    text: cleanText,
    citations: allCitations,
    artifacts,
    pageImages: allPageImages,
  };
}
