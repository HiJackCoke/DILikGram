// ============================================================================
// ERROR HANDLING
// ============================================================================

import OpenAI from "openai";

/**
 * Convert OpenAI SDK errors to user-friendly messages
 */
export function handleOpenAIError(error: unknown): never {
  if (error instanceof OpenAI.APIError) {
    if (error.status === 401) {
      throw new Error(
        "Invalid OpenAI API key. Please check your environment configuration.",
      );
    }
    if (error.status === 429) {
      throw new Error(
        "OpenAI rate limit exceeded. Please try again in a moment.",
      );
    }
    if (error.status === 500 || error.status === 503) {
      throw new Error(
        "OpenAI service temporarily unavailable. Please try again later.",
      );
    }

    throw new Error(`OpenAI API error: ${error.message}`);
  }

  if (error instanceof Error) {
    throw error;
  }

  throw new Error(
    "An unexpected error occurred while processing your request.",
  );
}

