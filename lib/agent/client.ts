import Anthropic from "@anthropic-ai/sdk";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api";
const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-20250514";
/** OpenRouter default when no direct Anthropic key — free tier model (not Claude). */
const DEFAULT_OPENROUTER_MODEL = "arcee-ai/trinity-large-preview:free";

/** Override with OPENROUTER_MODEL in .env if needed. */
export function resolveOpenRouterModel(): string {
  const fromEnv = process.env.OPENROUTER_MODEL?.trim();
  return fromEnv || DEFAULT_OPENROUTER_MODEL;
}

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
 * - If ANTHROPIC_API_KEY is set, always use Anthropic directly.
 * - Otherwise use OPENROUTER_API_KEY if set.
 * - LLM_PROVIDER=openrouter can still force OpenRouter when Anthropic key is absent.
 */
function resolveProvider(): LlmProvider {
  const anKey = process.env.ANTHROPIC_API_KEY?.trim();
  const orKey = process.env.OPENROUTER_API_KEY?.trim();

  if (anKey) return "anthropic";

  const explicit = process.env.LLM_PROVIDER?.toLowerCase().trim();
  if (explicit === "anthropic") {
    throw new Error(
      "LLM_PROVIDER=anthropic but ANTHROPIC_API_KEY is missing. Add ANTHROPIC_API_KEY or remove LLM_PROVIDER."
    );
  }
  if (explicit === "openrouter" && orKey) return "openrouter";
  if (explicit === "openrouter" && !orKey) {
    throw new Error(
      "LLM_PROVIDER=openrouter but OPENROUTER_API_KEY is missing. Add OPENROUTER_API_KEY or remove LLM_PROVIDER."
    );
  }

  if (orKey) return "openrouter";

  throw new Error(
    "No LLM API key found. Add ANTHROPIC_API_KEY to .env (required for reviewer setup), or add OPENROUTER_API_KEY as an optional fallback."
  );
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/** Anthropic SDK / OpenRouter often attach the HTTP JSON body on the thrown object. */
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
 * Pulls a human-readable message from Anthropic/OpenRouter JSON error bodies
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

/**
 * When Anthropic returns billing / credit errors, retry via OpenRouter if configured.
 */
export function getOpenRouterClientOrNull(): {
  client: Anthropic;
  model: string;
} | null {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    client: new Anthropic({
      apiKey,
      baseURL: OPENROUTER_BASE_URL,
    }),
    model: resolveOpenRouterModel(),
  };
}

export function shouldFallbackToOpenRouterAfterAnthropicError(
  err: unknown
): boolean {
  if (!process.env.OPENROUTER_API_KEY?.trim()) return false;
  const msg = errorMessage(err).toLowerCase();
  if (msg.includes("credit balance")) return true;
  if (msg.includes("too low") && msg.includes("anthropic")) return true;
  if (msg.includes("billing")) return true;
  if (msg.includes("payment_required")) return true;
  if (msg.includes("insufficient_quota")) return true;
  if (typeof err === "object" && err !== null && "status" in err) {
    const st = (err as { status?: number }).status;
    if (st === 402) return true;
    if (st === 400 && (msg.includes("credit") || msg.includes("balance"))) {
      return true;
    }
  }
  return false;
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
      model: resolveOpenRouterModel(),
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
