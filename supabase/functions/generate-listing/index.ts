/**
 * generate-listing
 *
 * Generates listing ad text with Claude and streams it to the client
 * as Server-Sent Events. Supports generating everything ("all") or
 * regenerating a single part ("headline" | "body" | "facts") without
 * touching the others.
 *
 * SSE protocol (each event is a JSON object on a `data:` line):
 *   { type: "part_start", part }
 *   { type: "delta", part, text }        – incremental text
 *   { type: "part_done", part, text }    – final text for the part
 *   { type: "done", generated_text }     – all parts persisted
 *   { type: "error", message }           – Swedish, user-presentable
 *
 * The generated text is persisted server-side when generation
 * completes; a database trigger snapshots the previous version to
 * listing_versions so nothing is ever lost.
 */
import { AuthError, requireAuth, requireListingInOrg } from "../_shared/auth.ts";
import { corsHeaders, errorResponse, handleOptions } from "../_shared/http.ts";
import { AnthropicError, streamClaudeText } from "../_shared/anthropic.ts";
import { requireActiveSubscription, SubscriptionError } from "../_shared/subscription-guard.ts";
import {
  buildFactSheet,
  buildPartPrompt,
  buildSystemPrompt,
  GENERATION_PARTS,
  type GenerationPart,
  type ImageFinding,
  type ListingPromptData,
  PART_MAX_TOKENS,
  PROMPT_VERSION,
} from "../_shared/prompts/listing-generation.ts";

interface GenerateRequest {
  listing_id?: string;
  part?: string;
}

interface GeneratedText {
  headline?: string;
  body?: string;
  facts?: string;
}

function isGenerationPart(value: string): value is GenerationPart {
  return (GENERATION_PARTS as string[]).includes(value);
}

/** Strips wrapping quotes and surrounding whitespace from model output. */
function cleanOutput(text: string): string {
  return text.trim().replace(/^["']+|["']+$/g, "").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions();
  if (req.method !== "POST") return errorResponse("Metoden stöds inte.", 405);

  let ctx;
  let listing: Record<string, unknown>;
  let parts: GenerationPart[];

  try {
    ctx = await requireAuth(req);
    await requireActiveSubscription(ctx);

    let body: GenerateRequest;
    try {
      body = (await req.json()) as GenerateRequest;
    } catch {
      return errorResponse("Ogiltig förfrågan.", 400);
    }

    if (!body.listing_id) {
      return errorResponse("Annons-id saknas.", 400);
    }

    const requestedPart = body.part ?? "all";
    if (requestedPart !== "all" && !isGenerationPart(requestedPart)) {
      return errorResponse("Ogiltig del av annonsen.", 400);
    }
    parts = requestedPart === "all" ? [...GENERATION_PARTS] : [requestedPart];

    // Ownership check: 404 if the listing is not in the caller's org.
    listing = await requireListingInOrg(ctx, body.listing_id);
  } catch (error) {
    if (error instanceof AuthError || error instanceof SubscriptionError) {
      return errorResponse(error.message, error.status);
    }
    console.error("generate-listing: setup failed", error);
    return errorResponse("Något gick fel. Försök igen om en stund.", 500);
  }

  // Confirmed image analyses feed the fact sheet (step B integration).
  const { data: imageRows } = await ctx.admin
    .from("listing_images")
    .select("ai_analysis_result")
    .eq("listing_id", listing.id as string)
    .eq("organization_id", ctx.organizationId)
    .not("ai_analysis_result", "is", null)
    .order("sort_order");

  const imageFindings: ImageFinding[] = (imageRows ?? [])
    .map((row) => row.ai_analysis_result as ImageFinding & { confirmed?: boolean })
    .filter((analysis) => analysis && analysis.confirmed !== false);

  const promptData = listing as unknown as ListingPromptData;
  const factSheet = buildFactSheet(promptData, imageFindings);
  const systemPrompt = buildSystemPrompt(
    promptData.tone,
    promptData.target_audience
  );

  const existingText: GeneratedText =
    (listing.generated_text as GeneratedText | null) ?? {};

  const encoder = new TextEncoder();
  const organizationId = ctx.organizationId;
  const admin = ctx.admin;
  const listingId = listing.id as string;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      const results: GeneratedText = { ...existingText };

      try {
        for (const part of parts) {
          send({ type: "part_start", part });

          const prompt = buildPartPrompt(part, factSheet, results);
          const rawText = await streamClaudeText({
            system: systemPrompt,
            messages: [{ role: "user", content: prompt }],
            maxTokens: PART_MAX_TOKENS[part],
            onDelta: (text) => send({ type: "delta", part, text }),
          });

          results[part] = cleanOutput(rawText);
          send({ type: "part_done", part, text: results[part] });
        }

        const { error: updateError } = await admin
          .from("listings")
          .update({ generated_text: results })
          .eq("id", listingId)
          .eq("organization_id", organizationId);

        if (updateError) {
          console.error("generate-listing: persist failed", updateError);
          send({
            type: "error",
            message:
              "Texten genererades men kunde inte sparas. Kopiera texten och försök spara igen.",
          });
        } else {
          send({ type: "done", generated_text: results, prompt_version: PROMPT_VERSION });
        }
      } catch (error) {
        const message = error instanceof AnthropicError
          ? error.message
          : "AI-genereringen misslyckades. Försök igen.";
        if (!(error instanceof AnthropicError)) {
          console.error("generate-listing: generation failed", error);
        }
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});
