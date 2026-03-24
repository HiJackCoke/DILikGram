import type { AnalyzePRDResult } from "./prdAnalysis";
import type { WorkflowNode } from "@/types/nodes";

export interface GeneratedUIPage {
  pageId: string;
  pageName: string;
  pagePath?: string;
  /** Self-contained React JSX string — function App() { ... } */
  code: string;
  status: "pending" | "generating" | "done" | "error";
  error?: string;
}

export interface GenerateUIResponse {
  pages: GeneratedUIPage[];
}

export interface GenerateUIActionParams {
  analysisResult: AnalyzePRDResult;
  nodes: WorkflowNode[];
  /** If set, skip API call and use pre-built fixture for this sample scenario */
  sampleId?: string;
}
