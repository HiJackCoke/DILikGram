"use server";

import { AnalyzePRD, PRDAnalysisResult } from "@/types/ai/prdAnalysis";
import { getOpenAIClient } from "./client";
import pdfParse from "pdf-parse/lib/pdf-parse.js";

import {
  ANALYSIS_SYSTEM_PROMPT,
  getAnalysisContent,
} from "@/fixtures/prompts/analysis";
import { handleOpenAIError } from "./errors";

/**
 * Analyze PRD and extract page/feature structure (Step 1 of 2-step pipeline)
 *
 * @param pdfContent - Base64 PDF data URL or plain text PRD
 * @param prompt - User's additional context/instructions
 * @returns Structured PRD analysis with pages and features
 */
export const analyzePRD: AnalyzePRD = async (pdfContent, prompt) => {
  if (!pdfContent || !pdfContent.trim()) {
    throw new Error("PRD content is required for analysis");
  }

  try {
    const openai = getOpenAIClient();

    let prdText: string;
    if (pdfContent.startsWith("data:application/pdf;base64,")) {
      const base64Data = pdfContent.replace(
        /^data:application\/pdf;base64,/,
        "",
      );
      const pdfBuffer = Buffer.from(base64Data, "base64");
      const pdfData = await pdfParse(pdfBuffer);
      prdText = pdfData.text;
    } else {
      prdText = pdfContent;
    }

    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      instructions: ANALYSIS_SYSTEM_PROMPT,
      input: getAnalysisContent(prdText, prompt),
      text: {
        format: { type: "json_object" },
      },
    });

    const content = response.output_text;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    const result = JSON.parse(content) as PRDAnalysisResult;

    if (!result.goal || !Array.isArray(result.pages)) {
      throw new Error("Invalid analysis response structure from OpenAI");
    }

    return result;
  } catch (error) {
    handleOpenAIError(error);
  }
};
