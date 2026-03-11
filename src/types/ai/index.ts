import type { WorkflowNode } from "@/types";
import { ReusableNodeTemplate } from "../prd";
import type { AnalyzePRDResult } from "./prdAnalysis";

export interface GenerateWorkflowResponse {
  nodes: WorkflowNode[];

  metadata: {
    description: string;
    estimatedComplexity: "simple" | "moderate" | "complex";
    /** AI-generated summary of PRD requirements */
    prdSummary?: string;
    /** IDs of nodes reused from library */
    reusedNodes?: string[];
  };
}

export type GenerateWorkflowActionParams = {
  prompt: string;
  nodeLibrary?: ReusableNodeTemplate[];
  analysisResult?: AnalyzePRDResult | null;
};

export type GenerateWorkflowAction = (
  params: GenerateWorkflowActionParams,
) => Promise<GenerateWorkflowResponse>;

export interface UpdateWorkflowResponse {
  nodes: {
    update: WorkflowNode[];
    // Union type: ParentNode-First format OR enriched WorkflowNode
    create: WorkflowNode[];
    delete: string[]; // Node IDs to delete
  };

  metadata: {
    description: string; // Description of changes made
    affectedNodeIds: string[]; // IDs of nodes affected by the edit
  };
}

export type UpdateWorkflowAction = (
  nodeId: string,
  prompt: string,
  nodes: WorkflowNode[],
) => Promise<UpdateWorkflowResponse>;
