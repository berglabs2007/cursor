/**
 * analyze-images
 *
 * Analyzes one listing image with Claude vision:
 *  1. Validates the caller's session and that the image belongs to
 *     their organization.
 *  2. Downloads the image from the private Storage bucket.
 *  3. Asks Claude for a structured Swedish analysis (room type, light,
 *     condition, materials, notable details).
 *  4. Persists the result on the listing_images row.
 *
 * The client calls this once per image (with limited concurrency) so
 * the UI can show per-image progress and retry individual failures.
 */
import { AuthError, requireAuth } from "../_shared/auth.ts";
import { errorResponse, handleOptions, jsonResponse } from "../_shared/http.ts";
import { AnthropicError, completeClaude } from "../_shared/anthropic.ts";
import { requireActiveSubscription, SubscriptionError } from "../_shared/subscription-guard.ts";
import {
  IMAGE_ANALYSIS_SYSTEM_PROMPT,
  IMAGE_ANALYSIS_USER_PROMPT,
  IMAGE_PROMPT_VERSION,
  parseImageAnalysis,
} from "../_shared/prompts/image-analysis.ts";

const SUPPORTED_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

interface AnalyzeRequest {
  image_id?: string;
}

function mediaTypeFromPath(path: string): string {
  const extension = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  switch (extension) {
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    default:
      return "image/jpeg";
  }
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions();
  if (req.method !== "POST") return errorResponse("Metoden stöds inte.", 405);

  try {
    const ctx = await requireAuth(req);
    await requireActiveSubscription(ctx);

    let body: AnalyzeRequest;
    try {
      body = (await req.json()) as AnalyzeRequest;
    } catch {
      return errorResponse("Ogiltig förfrågan.", 400);
    }

    if (!body.image_id) {
      return errorResponse("Bild-id saknas.", 400);
    }

    // Ownership check via organization_id – never trust client-side org.
    const { data: image, error: imageError } = await ctx.admin
      .from("listing_images")
      .select("id, storage_path, listing_id")
      .eq("id", body.image_id)
      .eq("organization_id", ctx.organizationId)
      .maybeSingle();

    if (imageError) {
      console.error("analyze-images: image lookup failed", imageError);
      return errorResponse("Kunde inte läsa bilden. Försök igen.", 500);
    }
    if (!image) {
      return errorResponse("Bilden finns inte eller tillhör inte din byrå.", 404);
    }

    const { data: file, error: downloadError } = await ctx.admin.storage
      .from("listing-images")
      .download(image.storage_path as string);

    if (downloadError || !file) {
      console.error("analyze-images: download failed", downloadError);
      return errorResponse("Kunde inte hämta bilden från lagringen. Försök igen.", 500);
    }

    const mediaType = file.type && SUPPORTED_MEDIA_TYPES.has(file.type)
      ? file.type
      : mediaTypeFromPath(image.storage_path as string);

    if (!SUPPORTED_MEDIA_TYPES.has(mediaType)) {
      return errorResponse("Bildformatet stöds inte. Använd JPEG, PNG eller WebP.", 415);
    }

    const base64 = toBase64(await file.arrayBuffer());

    const rawResponse = await completeClaude({
      system: IMAGE_ANALYSIS_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64 },
            },
            { type: "text", text: IMAGE_ANALYSIS_USER_PROMPT },
          ],
        },
      ],
      maxTokens: 1024,
    });

    let analysis;
    try {
      analysis = parseImageAnalysis(rawResponse);
    } catch (parseError) {
      console.error("analyze-images: unparseable model response", parseError, rawResponse);
      return errorResponse("Bildanalysen gav ett oväntat svar. Försök igen.", 502);
    }

    // confirmed: true by default – the agent can exclude or edit the
    // result in the UI before generating text.
    const result = { ...analysis, confirmed: true };

    const { error: updateError } = await ctx.admin
      .from("listing_images")
      .update({ ai_analysis_result: result })
      .eq("id", image.id as string)
      .eq("organization_id", ctx.organizationId);

    if (updateError) {
      console.error("analyze-images: persist failed", updateError);
      return errorResponse("Analysen kunde inte sparas. Försök igen.", 500);
    }

    return jsonResponse({
      image_id: image.id,
      analysis: result,
      prompt_version: IMAGE_PROMPT_VERSION,
    });
  } catch (error) {
    if (error instanceof AuthError || error instanceof SubscriptionError) {
      return errorResponse(error.message, error.status);
    }
    if (error instanceof AnthropicError) {
      return errorResponse(error.message, error.status);
    }
    console.error("analyze-images: unexpected error", error);
    return errorResponse("Något gick fel. Försök igen om en stund.", 500);
  }
});
