/**
 * Sample PRD fixtures
 *
 * Pre-sampled analysis results + validated workflow nodes for each demo scenario.
 * These are loaded by the WorkflowGenerator modal to bypass API calls for samples.
 *
 * To regenerate: npx tsx --tsconfig tsconfig.json scripts/capture-samples.ts <scenario>
 */

import type { AnalyzePRDResult } from "@/types/ai/prdAnalysis";
import type { WorkflowNode } from "@/types/nodes";

import fitnessJson from "./data/fitness.json";
import basketballJson from "./data/basketball.json";
import travelJson from "./data/travel.json";
import focusJson from "./data/focus.json";

export interface SamplePRD {
  id: string;
  name: string;
  description: string;
  emoji: string;
  analysisResult: AnalyzePRDResult;
  nodes: WorkflowNode[];
}

interface SampleData {
  capturedAt: string;
  analysisResult: AnalyzePRDResult;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  nodes: any[];
}

const SAMPLE_DEFINITIONS: Array<{
  id: string;
  name: string;
  description: string;
  emoji: string;
  data: SampleData;
}> = [
  {
    id: "fitness",
    name: "Fitness & Diet App",
    description: "운동 계획, 식단 추적, 건강 모니터링",
    emoji: "🏃",
    data: fitnessJson as unknown as SampleData,
  },
  {
    id: "basketball",
    name: "Basketball App",
    description: "팀 관리, 경기 일정, 통계 추적",
    emoji: "🏀",
    data: basketballJson as unknown as SampleData,
  },
  {
    id: "travel",
    name: "Travel Planner",
    description: "여행 계획, 일정 관리, 예약 시스템",
    emoji: "✈️",
    data: travelJson as unknown as SampleData,
  },
  {
    id: "focus",
    name: "Daily Focus App",
    description: "집중 타이머, 할 일 관리, 생산성 추적",
    emoji: "🎯",
    data: focusJson as unknown as SampleData,
  },
];

// Only expose samples that have been captured (nodes array is non-empty)
export const SAMPLE_PRDS: SamplePRD[] = SAMPLE_DEFINITIONS
  .filter((s) => s.data.nodes.length > 0)
  .map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    emoji: s.emoji,
    analysisResult: s.data.analysisResult,
    nodes: s.data.nodes as WorkflowNode[],
  }));

export function getSampleById(id: string): SamplePRD | undefined {
  return SAMPLE_PRDS.find((s) => s.id === id);
}
