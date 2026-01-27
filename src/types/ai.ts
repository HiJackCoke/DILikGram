import type { WorkflowNode } from "@/types";

export interface GenerateWorkflowProps {
  apiKey: string;
  prompt: string;
}

export interface GenerateWorkflowResponse {
  nodes: WorkflowNode[];

  metadata: {
    description: string;
    estimatedComplexity: "simple" | "moderate" | "complex";
  };
}

export type GenerateWorkflow = (
  props: GenerateWorkflowProps
) => Promise<GenerateWorkflowResponse>;

export interface UpdateWorkflowProps extends GenerateWorkflowProps {
  nodeId: string;
  nodes: WorkflowNode[];
}

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

export type UpdateWorkflow = (
  props: UpdateWorkflowProps
) => Promise<UpdateWorkflowResponse>;

export interface FetchOpenAI {
  apiKey: string;
  messages: Array<{ role: string; content: string }>;
  model: "gpt-4o-mini" | "gpt-4o";
  jsonSchema?: object;
}
