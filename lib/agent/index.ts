import type Anthropic from "@anthropic-ai/sdk";
import {
  getLlmClientAndModel,
  getLlmMaxOutputTokens,
  getOpenRouterClientOrNull,
  shouldFallbackToOpenRouterAfterAnthropicError,
} from "./client";
import { SYSTEM_PROMPT } from "./system-prompt";
import { toolDefinitions, executeToolCall } from "./tools";
import type { Citation, Artifact, PageImage, ChatMessage } from "../types";
import { SOURCE_LABELS } from "../types";

const MAX_TOOL_ROUNDS = 6;

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

export async function runAgent(
  messages: ChatMessage[],
  options: RunAgentOptions = {}
): Promise<AgentResult> {
  const { onStatus, onTextDelta, onCitation, onArtifact, onPageImage } = options;
  let { client, model, provider } = getLlmClientAndModel();
  const maxTokens = getLlmMaxOutputTokens();
  let usedOpenRouterBillingFallback = false;

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

  const createAssistantResponse = async (requestOptions: CreateResponseOptions) => {
    try {
      return await streamAssistantResponse(client, model, requestOptions);
    } catch (err) {
      if (
        provider === "anthropic" &&
        !usedOpenRouterBillingFallback &&
        shouldFallbackToOpenRouterAfterAnthropicError(err)
      ) {
        const or = getOpenRouterClientOrNull();
        if (or) {
          usedOpenRouterBillingFallback = true;
          client = or.client;
          model = or.model;
          provider = "openrouter";
          console.warn(
            "[agent] Anthropic request failed (credits/billing); retrying via OpenRouter."
          );
          return await streamAssistantResponse(client, model, requestOptions);
        }
      }
      throw err;
    }
  };

  const getToolStatusMessage = (
    toolName: string,
    toolInput: Record<string, unknown>
  ): string | null => {
    switch (toolName) {
      case "search_manual": {
        const query = String(toolInput.query ?? "query");
        return `Searching manual for '${query}'...`;
      }
      case "get_page": {
        const pageNumber = Number(toolInput.page_number ?? 0);
        const source = String(toolInput.source ?? "owner-manual");
        const sourceLabel = SOURCE_LABELS[source] ?? source;
        return `Reading ${sourceLabel} page ${pageNumber}...`;
      }
      case "get_page_image": {
        const pageNumber = Number(toolInput.page_number ?? 0);
        return `Pulling diagram from page ${pageNumber}...`;
      }
      case "get_diagram": {
        const diagramName = String(toolInput.diagram_id ?? "requested");
        return `Loading ${diagramName} diagram...`;
      }
      case "lookup_specs": {
        const query = String(toolInput.spec_type ?? "requested");
        return `Looking up specs for ${query}...`;
      }
      default:
        return null;
    }
  };

  const getToolCompleteStatusMessage = (
    toolName: string,
    result: Awaited<ReturnType<typeof executeToolCall>>
  ): string | null => {
    if (toolName !== "search_manual") return null;
    const citations = result.citations ?? [];
    if (!citations.length) {
      return "Found 0 relevant pages — reading page 1...";
    }
    const topPage = citations[0]?.pageNumber ?? 1;
    return `Found ${citations.length} relevant pages — reading page ${topPage}...`;
  };

  const emitCitation = async (citation: Citation) => {
    const key = `${citation.source}:${citation.pageNumber}`;
    if (seenCitationKeys.has(key)) return;
    seenCitationKeys.add(key);
    allCitations.push(citation);
  };

  const emitPageImage = async (pageImage: PageImage) => {
    const key = `${pageImage.source}:${pageImage.pageNumber}`;
    if (seenPageImageKeys.has(key)) return;
    seenPageImageKeys.add(key);
    allPageImages.push(pageImage);
  };

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
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

    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
    for (const toolUse of toolUseBlocks) {
      const input = toolUse.input as Record<string, unknown>;
      const statusMessage = getToolStatusMessage(toolUse.name, input);
      if (statusMessage && onStatus) {
        await onStatus(statusMessage);
      }
      const result = await executeToolCall(
        toolUse.name,
        input
      );
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

      toolResults.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: result.content,
      });
    }

    anthropicMessages.push({
      role: "user",
      content: toolResults,
    });
  }

  if (onStatus) {
    await onStatus("Synthesizing answer...");
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
  if (onCitation) {
    for (const citation of allCitations) {
      await onCitation(citation);
    }
  }
  if (onArtifact) {
    for (const artifact of artifacts) {
      await onArtifact(artifact);
    }
  }
  if (onPageImage) {
    for (const pageImage of allPageImages) {
      await onPageImage(pageImage);
    }
  }

  return {
    text: cleanText,
    citations: allCitations,
    artifacts,
    pageImages: allPageImages,
  };
}
