/**
 * Thin client for the Anthropic Messages API (Deno).
 * All Claude calls in BergLabs go through this module so the model,
 * timeouts and error mapping live in one place.
 */

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

export const CLAUDE_MODEL = "claude-sonnet-4-6";

/** Error with a user-presentable Swedish message. */
export class AnthropicError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AnthropicError";
    this.status = status;
  }
}

function mapErrorStatus(status: number): AnthropicError {
  if (status === 401 || status === 403) {
    return new AnthropicError("AI-tjänsten är felkonfigurerad. Kontakta support.", 500);
  }
  if (status === 429) {
    return new AnthropicError(
      "Många förfrågningar just nu. Vänta en stund och försök igen.",
      429
    );
  }
  if (status === 529 || status >= 500) {
    return new AnthropicError(
      "AI-tjänsten är tillfälligt överbelastad. Försök igen om en stund.",
      503
    );
  }
  return new AnthropicError("AI-genereringen misslyckades. Försök igen.", 502);
}

function getApiKey(): string {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    throw new AnthropicError("AI-tjänsten är felkonfigurerad. Kontakta support.", 500);
  }
  return apiKey;
}

export type MessageContent =
  | string
  | Array<
    | { type: "text"; text: string }
    | {
      type: "image";
      source: { type: "base64"; media_type: string; data: string };
    }
  >;

export interface ClaudeMessage {
  role: "user" | "assistant";
  content: MessageContent;
}

interface StreamTextOptions {
  system: string;
  messages: ClaudeMessage[];
  maxTokens: number;
  temperature?: number;
  timeoutMs?: number;
  onDelta?: (text: string) => void;
}

/**
 * Streams a text completion from Claude. Calls onDelta for every text
 * chunk and resolves with the full text.
 */
export async function streamClaudeText(options: StreamTextOptions): Promise<string> {
  const apiKey = getApiKey();
  const timeout = AbortSignal.timeout(options.timeoutMs ?? 90_000);

  let response: Response;
  try {
    response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: options.maxTokens,
        temperature: options.temperature ?? 0.7,
        system: options.system,
        messages: options.messages,
        stream: true,
      }),
      signal: timeout,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new AnthropicError(
        "AI-genereringen tog för lång tid. Försök igen.",
        504
      );
    }
    throw new AnthropicError("Kunde inte nå AI-tjänsten. Försök igen.", 502);
  }

  if (!response.ok || !response.body) {
    response.body?.cancel();
    throw mapErrorStatus(response.status);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      // Keep the last (possibly incomplete) line in the buffer.
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (!payload || payload === "[DONE]") continue;

        let event: {
          type?: string;
          delta?: { type?: string; text?: string };
          error?: { message?: string };
        };
        try {
          event = JSON.parse(payload);
        } catch {
          continue;
        }

        if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
          const text = event.delta.text ?? "";
          fullText += text;
          options.onDelta?.(text);
        } else if (event.type === "error") {
          console.error("anthropic stream error", event.error);
          throw new AnthropicError(
            "AI-genereringen avbröts av ett fel. Försök igen.",
            502
          );
        }
      }
    }
  } catch (error) {
    if (error instanceof AnthropicError) throw error;
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new AnthropicError("AI-genereringen tog för lång tid. Försök igen.", 504);
    }
    throw new AnthropicError("Anslutningen till AI-tjänsten bröts. Försök igen.", 502);
  } finally {
    reader.releaseLock();
  }

  if (!fullText.trim()) {
    throw new AnthropicError("AI-tjänsten returnerade ett tomt svar. Försök igen.", 502);
  }

  return fullText;
}

interface CompleteOptions {
  system: string;
  messages: ClaudeMessage[];
  maxTokens: number;
  temperature?: number;
  timeoutMs?: number;
}

/**
 * Non-streaming completion. Used by analyze-images where the response
 * is structured JSON rather than user-facing prose.
 */
export async function completeClaude(options: CompleteOptions): Promise<string> {
  const apiKey = getApiKey();
  const timeout = AbortSignal.timeout(options.timeoutMs ?? 60_000);

  let response: Response;
  try {
    response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: options.maxTokens,
        temperature: options.temperature ?? 0.2,
        system: options.system,
        messages: options.messages,
      }),
      signal: timeout,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new AnthropicError("AI-analysen tog för lång tid. Försök igen.", 504);
    }
    throw new AnthropicError("Kunde inte nå AI-tjänsten. Försök igen.", 502);
  }

  if (!response.ok) {
    response.body?.cancel();
    throw mapErrorStatus(response.status);
  }

  const data = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text = data.content
    ?.filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("");

  if (!text?.trim()) {
    throw new AnthropicError("AI-tjänsten returnerade ett tomt svar. Försök igen.", 502);
  }

  return text;
}
