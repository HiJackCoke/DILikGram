/**
 * Type definitions for WorkflowVersioning context
 */

import type { WorkflowVersion, VersionDiff } from "@/types/version";
import type { WorkflowNode } from "@/types/nodes";
import type { WorkflowEdge } from "@/types/edges";

/**
 * Callback function called when a version is restored
 */
export type OnRestoreCallback = (
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
) => void;

/**
 * WorkflowVersioning context value exposed to consumers
 */
export interface WorkflowVersioningContextValue {
  // Current state
  currentVersion: WorkflowVersion | null;
  versions: WorkflowVersion[];

  // Version management

  // History panel state
  show: boolean;

  canUndo: boolean;
  canRedo: boolean;

  storageStats: {
    versionCount: number;
    currentSizeMB: number;
    maxSizeMB: number;
    warningThreshold: number;
  };
  save: (
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
    metadata: Omit<WorkflowVersion["metadata"], "stats">,
  ) => void;
  restore: (versionId: string) => void;
  delete: (versionId: string) => void;
  clear: () => void;
  compare: (fromId: string, toId: string) => VersionDiff | null;
  open: () => void;
  close: () => void;
  undo: () => void;
  redo: () => void;
  registerOnRestore: (callback: OnRestoreCallback) => () => void;
}
