/**
 * Type definitions for AIWorkflowEditor context
 */

import type { WorkflowNode } from "@/types/nodes";
import type { WorkflowEdge } from "@/types/edges";

/**
 * AI Workflow Editor state
 */
export interface AIWorkflowEditorState {
  isOpen: boolean;
  nodeId: string | null;
  nodePosition: { x: number; y: number } | null;
}

/**
 * Callback function called when workflow is edited
 */
export type OnWorkflowEditCallback = (
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
) => void;

/**
 * AIWorkflowEditor context value exposed to consumers
 */
export interface AIWorkflowEditorContextValue {
  state: AIWorkflowEditorState;
  isEditing: boolean;
  error: string | null;

  /**
   * Open AI edit panel for a specific node
   */
  open: (nodeId: string, position: { x: number; y: number }) => void;

  /**
   * Close AI edit panel
   */
  close: () => void;

  /**
   * Register callback to handle edited workflow
   */
  registerOnEdit: (callback: OnWorkflowEditCallback) => () => void;

  /**
   * Set current workflow state for edit operations
   */
  setCurrentWorkflow: (nodes: WorkflowNode[], edges: WorkflowEdge[]) => void;

  /**
   * Handle edit operation (will be implemented in Stage 2)
   */
  handleEdit: (apiKey: string, nodeId: string, prompt: string) => Promise<void>;
}
