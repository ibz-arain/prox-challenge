import Anthropic from "@anthropic-ai/sdk";
import { resolveOpenRouterModel } from "../agent/client";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api";
const VISION_PROMPT =
  "This is a page from a welding machine manual. Extract ALL technical content from this image: tables, charts, settings, labels, numbers, and any structured data. Return it as clean, structured text preserving all data relationships.";

const ANTHROPIC_MODELS = [
  "claude-sonnet-4-20250514",
  "claude-haiku-3-5-20241022",
];

interface VisionClientConfig {
  client: Anthropic;
  models: string[];
}

let cachedConfig: VisionClientConfig | null | undefined;

function getVisionClientConfig(): VisionClientConfig | null {
  if (cachedConfig !== undefined) {
    return cachedConfig;
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (anthropicKey) {
    cachedConfig = {
      client: new Anthropic({ apiKey: anthropicKey }),
      models: ANTHROPIC_MODELS,
    };
    return cachedConfig;
  }

  const openrouterKey = process.env.OPENROUTER_API_KEY?.trim();
  if (openrouterKey) {
    cachedConfig = {
      client: new Anthropic({
        apiKey: openrouterKey,
        baseURL: OPENROUTER_BASE_URL,
      }),
      models: [resolveOpenRouterModel()],
    };
    return cachedConfig;
  }

  cachedConfig = null;
  return null;
}

export interface VisionExtractionResult {
  text: string;
  model: string;
}

export async function extractPageTextWithVision(
  pageBase64Png: string
): Promise<VisionExtractionResult | null> {
  const config = getVisionClientConfig();
  if (!config) {
    return null;
  }

  let lastError: unknown = null;

  for (const model of config.models) {
    try {
      const response = await config.client.messages.create({
        model,
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/png",
                  data: pageBase64Png,
                },
              },
              {
                type: "text",
                text: VISION_PROMPT,
              },
            ],
          },
        ],
      });

      const text = response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text.trim())
        .filter(Boolean)
        .join("\n\n")
        .trim();

      if (text.length >= 50) {
        return { text, model };
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  return null;
}
