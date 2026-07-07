"use client";

import { createClient } from "@/lib/supabase/client";
import type { GeneratedListingText } from "@/lib/database.types";

export type GenerationPart = "headline" | "body" | "facts";

export type GenerationEvent =
  | { type: "part_start"; part: GenerationPart }
  | { type: "delta"; part: GenerationPart; text: string }
  | { type: "part_done"; part: GenerationPart; text: string }
  | { type: "done"; generated_text: GeneratedListingText }
  | { type: "error"; message: string };

/**
 * Calls the generate-listing Edge Function and yields SSE events as
 * they arrive, so the UI can render the text while it is generated.
 */
export async function* streamListingGeneration(
  listingId: string,
  part: GenerationPart | "all",
  signal?: AbortSignal
): AsyncGenerator<GenerationEvent> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    yield { type: "error", message: "Du är inte inloggad. Logga in och försök igen." };
    return;
  }

  let response: Response;
  try {
    response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-listing`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ listing_id: listingId, part }),
        signal,
      }
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    yield {
      type: "error",
      message: "Kunde inte nå servern. Kontrollera din uppkoppling och försök igen.",
    };
    return;
  }

  if (!response.ok || !response.body) {
    let message = "AI-genereringen misslyckades. Försök igen.";
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // Keep the generic message.
    }
    yield { type: "error", message };
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (!payload) continue;

        let event: GenerationEvent;
        try {
          event = JSON.parse(payload) as GenerationEvent;
        } catch {
          continue;
        }
        yield event;
      }
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    yield {
      type: "error",
      message: "Anslutningen bröts under genereringen. Försök igen.",
    };
  } finally {
    reader.releaseLock();
  }
}
