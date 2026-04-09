import Anthropic from "@anthropic-ai/sdk";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api";
const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-20250514";
/** OpenRouter slug; Claude models preserve tool use + artifact behavior best. */
const DEFAULT_OPENROUTER_MODEL = "anthropic/claude-sonnet-4.5";

/** Default output cap: keeps OpenRouter low-credit accounts under typical 402 limits. */
const DEFAULT_MAX_OUTPUT_TOKENS = 2048;
const MIN_MAX_TOKENS = 256;
const MAX_MAX_TOKENS = 8192;

export type LlmProvider = "anthropic" | "openrouter";

export function getLlmMaxOutputTokens(): number {
  const raw = process.env.LLM_MAX_TOKENS?.trim();
  if (raw) {
    const n = parseInt(raw, 10);
    if (!Number.isNaN(n)) {
      return Math.min(MAX_MAX_TOKENS, Math.max(MIN_MAX_TOKENS, n));
    }
  }
  return DEFAULT_MAX_OUTPUT_TOKENS;
}

/**
 * Resolves which backend to use:
 * - LLM_PROVIDER=anthropic | openrouter forces that provider (if key present).
 * - Otherwise: use OpenRouter if OPENROUTER_API_KEY is set, else Anthropic if ANTHROPIC_API_KEY is set.
 * OpenRouter is preferred when both keys exist so local dev works without Anthropic credits.
 */
function resolveProvider(): LlmProvider {
  const explicit = process.env.LLM_PROVIDER?.toLowerCase().trim();
  if (explicit === "anthropic") return "anthropic";
  if (explicit === "openrouter") return "openrouter";

  const orKey = process.env.OPENROUTER_API_KEY?.trim();
  const anKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (orKey) return "openrouter";
  if (anKey) return "anthropic";

  throw new Error(
    "No LLM API key found. Add OPENROUTER_API_KEY to .env (get one at https://openrouter.ai/settings/keys), or add ANTHROPIC_API_KEY for direct Anthropic."
  );
}

export function getLlmClientAndModel(): {
  client: Anthropic;
  model: string;
  provider: LlmProvider;
} {
  const provider = resolveProvider();

  if (provider === "openrouter") {
    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    if (!apiKey) {
      throw new Error(
        "LLM_PROVIDER=openrouter but OPENROUTER_API_KEY is missing. Add it to .env or unset LLM_PROVIDER to auto-pick a provider."
      );
    }
    const client = new Anthropic({
      apiKey,
      baseURL: OPENROUTER_BASE_URL,
    });
    return {
      client,
      model: DEFAULT_OPENROUTER_MODEL,
      provider: "openrouter",
    };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "LLM_PROVIDER=anthropic but ANTHROPIC_API_KEY is missing. Add it to .env or use OPENROUTER_API_KEY instead."
    );
  }
  const client = new Anthropic({ apiKey });
  return {
    client,
    model: DEFAULT_ANTHROPIC_MODEL,
    provider: "anthropic",
  };
}
