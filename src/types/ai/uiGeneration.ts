import type { AnalyzePRDResult } from "./prdAnalysis";
import type { WorkflowNode } from "@/types/nodes";

export interface UIComponent {
  /** camelCase unique key — matches data-dg-component attribute in generated code */
  componentKey: string;
  /** Human-readable component name */
  componentName: string;
  /**
   * IDs of workflow nodes that back this component.
   * Empty array means the component is rendered in the UI but has no workflow node basis (phantom).
   */
  nodeIds: string[];
}

export interface GeneratedUIPage {
  pageId: string;
  pageName: string;
  pagePath?: string;
  /** Self-contained React JSX string — function App() { ... } */
  code: string;
  status: "pending" | "generating" | "done" | "error";
  error?: string;
  /** Node-to-component traceability metadata */
  components?: UIComponent[];
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
