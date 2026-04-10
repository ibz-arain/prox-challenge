import Anthropic from "@anthropic-ai/sdk";
const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-20250514";

const DEFAULT_MAX_OUTPUT_TOKENS = 4096;
const MIN_MAX_TOKENS = 256;
const MAX_MAX_TOKENS = 8192;

export function isAnthropicConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

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

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/** Anthropic SDK errors often attach the HTTP JSON body on the thrown object. */
function messageFromThrownApiError(err: unknown): string | null {
  if (typeof err !== "object" || err === null) return null;
  const o = err as Record<string, unknown>;
  const body = o.error;
  if (body && typeof body === "object") {
    const msg = (body as { message?: unknown }).message;
    if (typeof msg === "string" && msg.trim()) return msg.trim();
  }
  return null;
}

function parseJsonErrorPayload(raw: string): string | null {
  const brace = raw.indexOf("{");
  if (brace === -1) return null;
  try {
    const parsed = JSON.parse(raw.slice(brace)) as {
      error?: { message?: string };
      message?: string;
    };
    const nested = parsed?.error?.message ?? parsed?.message;
    if (typeof nested === "string" && nested.trim()) {
      return nested.trim();
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Pulls a human-readable message from Anthropic JSON error bodies
 * (e.g. "400 {\"type\":\"error\",\"error\":{\"message\":\"...\"}}").
 */
export function formatApiErrorForUser(err: unknown): string {
  const fromObject = messageFromThrownApiError(err);
  if (fromObject) {
    return fromObject;
  }

  const raw = errorMessage(err);
  const fromJson = parseJsonErrorPayload(raw);
  if (fromJson) {
    return fromJson;
  }

  return raw;
}
export function getLlmClientAndModel(): {
  client: Anthropic;
  model: string;
} {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("No LLM API key found. Add ANTHROPIC_API_KEY to .env.");
  }

  const client = new Anthropic({ apiKey });
  return {
    client,
    model: DEFAULT_ANTHROPIC_MODEL,
  };
}
