import Dialog from "@/components/ui/Dialog";
import type { UpdateWorkflowAction, WorkflowNode } from "@/types";

/**
 * Result of a validation check
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Error type identifier (e.g., "INCOMPLETE_DECISION_NODES") */
  errorType?: string;
  /** Human-readable error message */
  errorMessage?: string;
  /** Nodes affected by this validation error */
  affectedNodes?: WorkflowNode[];
  /** Additional metadata about the error */
  metadata?: Record<string, unknown>;
}

/**
 * Context provided to validation pipeline
 * Contains shared resources needed by validators and repairs
 */
export interface ValidationContext {
  /** Current workflow nodes */
  nodes: WorkflowNode[];
  /** Dialog utility for user confirmation */
  dialog: Dialog;
  /** AI-powered workflow update function */
  updateWorkflowAction: UpdateWorkflowAction;
}
