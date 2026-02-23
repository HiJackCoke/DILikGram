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

/**
 * Validation progress information for loading UI
 */
export interface ValidationProgress {
  /** Name of current validator being executed */
  currentValidator: string | null;
  /** Total number of validators in pipeline */
  totalValidators: number;
  /** Number of completed validators */
  completedValidators: number;
  /** Current validation stage */
  status: "validating" | "repairing" | "completed";
  /** Optional: Detailed message for current step */
  message?: string;
  /** Current step in unified timeline (1-7: 1=AI generation, 2-7=validators) */
  currentStep?: number;
  /** Total steps in unified timeline (always 7) */
  totalSteps?: number;
}
