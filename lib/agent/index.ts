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

const MAX_TOOL_ROUNDS = 6;

interface AgentResult {
  text: string;
  citations: Citation[];
  artifacts: Artifact[];
  pageImages: PageImage[];
}

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
  onTextDelta?: (text: string) => void | Promise<void>,
  onStatusChange?: (status: "searching" | "generating") => void | Promise<void>
): Promise<AgentResult> {
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

  let allCitations: Citation[] = [];
  let allPageImages: PageImage[] = [];
  let fullText = "";

  const createAssistantResponse = async () => {
    const params = {
      model,
      max_tokens: maxTokens,
      system: SYSTEM_PROMPT,
      tools: toolDefinitions,
      messages: anthropicMessages,
    };
    try {
      return await client.messages.create(params);
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
          return await client.messages.create({
            ...params,
            model,
          });
        }
      }
      throw err;
    }
  };

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    if (onStatusChange) {
      await onStatusChange("generating");
    }
    const response = await createAssistantResponse();

    const textBlocks: string[] = [];
    const toolUseBlocks: Anthropic.Messages.ToolUseBlock[] = [];

    for (const block of response.content) {
      if (block.type === "text") {
        textBlocks.push(block.text);
        if (onTextDelta) {
          await onTextDelta(block.text);
        }
      } else if (block.type === "tool_use") {
        toolUseBlocks.push(block);
      }
    }

    if (textBlocks.length > 0) {
      fullText += textBlocks.join("");
    }

    if (response.stop_reason === "end_turn" || toolUseBlocks.length === 0) {
      break;
    }

    anthropicMessages.push({
      role: "assistant",
      content: response.content,
    });

    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
    if (onStatusChange) {
      await onStatusChange("searching");
    }
    for (const toolUse of toolUseBlocks) {
      const result = await executeToolCall(
        toolUse.name,
        toolUse.input as Record<string, unknown>
      );

      if (result.citations) {
        allCitations.push(...result.citations);
      }
      if (result.pageImages) {
        allPageImages.push(...result.pageImages);
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

  const { cleanText, artifacts } = parseArtifacts(fullText);

  const uniqueCitations = allCitations.filter(
    (c, i, arr) =>
      arr.findIndex(
        (x) => x.pageNumber === c.pageNumber && x.source === c.source
      ) === i
  );
  const uniquePageImages = allPageImages.filter(
    (p, i, arr) =>
      arr.findIndex(
        (x) => x.pageNumber === p.pageNumber && x.source === p.source
      ) === i
  );

  return {
    text: cleanText,
    citations: uniqueCitations,
    artifacts,
    pageImages: uniquePageImages,
  };
}
