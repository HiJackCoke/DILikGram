"use server";

import { AnalyzePRD, AnalyzePRDResult } from "@/types/ai/prdAnalysis";
import { getOpenAIClient } from "./client";
import pdfParse from "pdf-parse/lib/pdf-parse.js";

import {
  ANALYSIS_SYSTEM_PROMPT,
  getAnalysisContent,
} from "@/fixtures/prompts/analysis";
import { handleOpenAIError } from "./errors";

async function parsePdfText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfBuffer = Buffer.from(arrayBuffer);

  const versions = ["v1.10.100", "v1.9.426", "v2.0.550"] as const;

  for (let i = 0; i < versions.length; i++) {
    try {
      const pdfData = await pdfParse(pdfBuffer, { version: versions[i] });
      return pdfData.text;
    } catch {
      if (i === versions.length - 1) {
        throw new Error(
          `PDF 파일을 읽을 수 없습니다. 지원하지 않는 형식이거나 손상된 파일입니다: ${file.name}`,
        );
      }
    }
  }

  // unreachable
  throw new Error(`PDF 파싱 실패: ${file.name}`);
}

/**
 * Analyze PRD and extract page/feature structure (Step 1 of 2-step pipeline)
 *
 * @param pdfFiles - PDF files to parse (required in PDF mode, merged with separator)
 * @param prompt - PRD text content (text mode) or additional context (PDF mode)
 * @returns Structured PRD analysis with pages and features
 */
export const analyzePRD: AnalyzePRD = async ({ pdfFiles, prompt = "" }) => {
  if ((!pdfFiles || pdfFiles.length === 0) && !prompt?.trim()) {
    throw new Error("PRD content is required for analysis");
  }

  try {
    const openai = getOpenAIClient();

    let prdText: string;
    if (pdfFiles && pdfFiles.length > 0) {
      const parsedTexts = await Promise.all(
        pdfFiles.map((file) => parsePdfText(file)),
      );
      prdText = parsedTexts.join("\n\n---\n\n");
    } else {
      prdText = prompt;
    }

    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      instructions: ANALYSIS_SYSTEM_PROMPT,
      input: getAnalysisContent(prdText, prompt ?? ""),
      text: {
        format: { type: "json_object" },
      },
    });

    const content = response.output_text;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    const result = JSON.parse(content) as AnalyzePRDResult;

    if (!result.goal || !Array.isArray(result.pages)) {
      throw new Error("Invalid analysis response structure from OpenAI");
    }

    return result;
  } catch (error) {
    handleOpenAIError(error);
  }
};
