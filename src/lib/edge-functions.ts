"use client";

import { createClient } from "@/lib/supabase/client";

export class EdgeFunctionError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "EdgeFunctionError";
    this.status = status;
  }
}

interface ErrorBody {
  error?: string;
}

/**
 * Calls a Supabase Edge Function with the caller's session token and
 * returns the parsed JSON response. Throws EdgeFunctionError with a
 * Swedish, user-presentable message on failure.
 */
export async function callEdgeFunction<TResponse>(
  functionName: string,
  body: Record<string, unknown>,
  options?: { signal?: AbortSignal }
): Promise<TResponse> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new EdgeFunctionError("Du är inte inloggad. Logga in och försök igen.", 401);
  }

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${functionName}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
      signal: options?.signal,
    }
  );

  if (!response.ok) {
    let message = "Något gick fel. Försök igen om en stund.";
    try {
      const errorBody = (await response.json()) as ErrorBody;
      if (errorBody.error) {
        message = errorBody.error;
      }
    } catch {
      // Non-JSON error response – keep the generic message.
    }
    throw new EdgeFunctionError(message, response.status);
  }

  return (await response.json()) as TResponse;
}

/**
 * Calls an Edge Function that returns a binary file (e.g. Word export)
 * and triggers a browser download.
 */
export async function downloadEdgeFunction(
  functionName: string,
  body: Record<string, unknown>,
  filename: string,
  options?: { signal?: AbortSignal }
): Promise<void> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new EdgeFunctionError("Du är inte inloggad. Logga in och försök igen.", 401);
  }

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${functionName}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
      signal: options?.signal,
    }
  );

  if (!response.ok) {
    let message = "Exporten misslyckades. Försök igen.";
    try {
      const errorBody = (await response.json()) as ErrorBody;
      if (errorBody.error) message = errorBody.error;
    } catch {
      // Binary or non-JSON error body.
    }
    throw new EdgeFunctionError(message, response.status);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
