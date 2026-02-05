/**
 * Type definitions for Workflow Version Management System
 */

import type { WorkflowNode } from "@/types/nodes";
import type { WorkflowEdge } from "@/types/edges";

/**
 * Type of change that created this version
 */
export type ChangeType =
  | "initial" // First version created
  | "generated" // Created via WorkflowGenerator
  | "edited" // Modified via AIWorkflowEditor
  | "manual" // Manual user edits (future)
  | "restored"; // Restored from previous version

/**
 * Metadata about version creation and AI involvement
 */
export interface VersionMetadata {
  changeType: ChangeType;
  description?: string;

  // AI generation/edit metadata
  aiGenerated?: {
    prompt: string;
    affectedNodeIds?: string[];
    complexity?: "simple" | "moderate" | "complex";
  };

  // Statistics
  stats: {
    nodeCount: number;
    edgeCount: number;
  };
}

/**
 * A single version snapshot of the workflow
 */
export interface WorkflowVersion {
  id: string; // UUID
  timestamp: number; // Unix timestamp (milliseconds)
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  metadata: VersionMetadata;
}

/**
 * Complete version history for a workflow
 */
export interface WorkflowVersionHistory {
  versions: WorkflowVersion[];
  currentVersionId: string;
  workflowId: string;
}

/**
 * Difference between two versions
 */
export interface VersionDiff {
  added: {
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
  };
  removed: {
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
  };
  modified: {
    nodes: Array<{
      before: WorkflowNode;
      after: WorkflowNode;
    }>;
  };
}
