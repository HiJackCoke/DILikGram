/**
 * Type definitions for WorkflowGenerator context
 */

import type { WorkflowNode } from "@/types/nodes";
import type { WorkflowEdge } from "@/types/edges";
import type { ValidationProgress } from "../../types/ai/validators";
import type { GenerationMeta } from "@/types/version";

/**
 * Callback function called when workflow is generated
 *
 * @param nodes - Generated workflow nodes to add to canvas
 * @param edges - Generated workflow edges to add to canvas
 * @param generationMeta - AI generation metadata (present on AI-generated workflows)
 */
export type RegisterOnWorkflowGenerated = (
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  generationMeta?: GenerationMeta,
) => void;

/**
 * WorkflowGenerator context value exposed to consumers
 */
export interface WorkflowGeneratorContextValue {
  isGenerating: boolean;
  error: string | null;
  /**
   * Current validation progress information (null if not validating)
   */
  validationProgress: ValidationProgress | null;
  open: () => void;
  close: () => void;
  /**
   * Register callback to handle generated workflow
   *
   * @param callback - Function to call with generated nodes and edges
   * @returns Cleanup function to unregister callback
   */
  registerOnGenerate: (callback: RegisterOnWorkflowGenerated) => () => void;
  /**
   * Set current existing nodes for positioning calculations
   *
   * @param nodes - Current nodes on the canvas
   */
  setExistingNodes: (nodes: WorkflowNode[]) => void;
}
