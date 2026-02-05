/**
 * WorkflowVersioning Context Provider
 *
 * Manages workflow version history with localStorage persistence,
 * undo/redo functionality, and version restoration.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  type ReactNode,
  use,
  useEffect,
} from "react";
import { useBrowserState } from "@/hooks/useBrowserState";
import { workflowVersionStorage } from "@/utils/workflowVersionStorage";
import VersionHistoryPanel from "@/contexts/WorkflowVersioning/VersionHistoryPanel";
import type { WorkflowVersioningContextValue, OnRestoreCallback } from "./type";
import type { WorkflowVersion, VersionDiff } from "@/types/version";
import type { WorkflowNode } from "@/types/nodes";
import type { WorkflowEdge } from "@/types/edges";

const WorkflowVersioningContext =
  createContext<WorkflowVersioningContextValue | null>(null);

interface WorkflowVersioningProviderProps {
  children: ReactNode;
}

export function WorkflowVersioningProvider({
  children,
}: WorkflowVersioningProviderProps) {
  // State - Lazy initialization from localStorage
  // const isClientRendered = useBrowserEnv(({ window }) => !!window, false);
  const [versions, setVersions] = useBrowserState(
    () => workflowVersionStorage.getAllVersions(),
    [],
  );

  const [currentVersion, setCurrentVersion] = useBrowserState(
    () => workflowVersionStorage.getCurrentVersion(),
    null,
  );

  const [currentIndex, setCurrentIndex] = useBrowserState(() => {
    const cv = workflowVersionStorage.getCurrentVersion();
    const av = workflowVersionStorage.getAllVersions();
    if (cv && av.length > 0) {
      return av.findIndex((v) => v.id === cv.id);
    }
    return -1;
  }, -1);

  const [storageStats, setStorageStats] = useBrowserState(
    () => workflowVersionStorage.getStorageStats(),
    {
      versionCount: 0,
      currentSizeMB: 0,
      maxSizeMB: 5,
      warningThreshold: 40,
    },
  );

  const [show, setShow] = useState(false);

  // Restore callbacks
  const restoreCallbacksRef = useRef<Set<OnRestoreCallback>>(new Set());

  // Track if this is the initial load
  const isInitialLoadRef = useRef(true);

  /**
   * Trigger onRestore callbacks on initial load
   */
  useEffect(() => {
    // Only trigger on initial load when currentVersion first becomes available
    if (isInitialLoadRef.current && currentVersion) {
      isInitialLoadRef.current = false;

      // Notify all restore listeners with initial data
      restoreCallbacksRef.current.forEach((callback) => {
        callback(currentVersion.nodes, currentVersion.edges);
      });
    }
  }, [currentVersion]);

  /**
   * Update storage statistics
   */
  const updateStorageStats = () => {
    const stats = workflowVersionStorage.getStorageStats();
    setStorageStats(stats);
  };

  /**
   * Save a new version
   */
  const saveVersion = (
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
    metadata: Omit<WorkflowVersion["metadata"], "stats">,
  ) => {
    const newVersion = workflowVersionStorage.createVersion(
      nodes,
      edges,
      metadata,
    );

    const success = workflowVersionStorage.appendVersion(newVersion);

    if (success) {
      setCurrentVersion(newVersion);

      // Reload all versions
      const allVersions = workflowVersionStorage.getAllVersions();
      setVersions(allVersions);

      // Update current index
      setCurrentIndex(0); // New version is always at index 0

      // Update stats
      updateStorageStats();

      console.info(`Version saved: ${newVersion.id}`, {
        changeType: metadata.changeType,
        nodeCount: nodes.length,
        edgeCount: edges.length,
      });
    } else {
      console.error("Failed to save version");
    }
  };

  /**
   * Restore a specific version
   */
  const restoreVersion = (versionId: string) => {
    const version = workflowVersionStorage.restore(versionId);

    if (version) {
      setCurrentVersion(version);

      // Update current index
      const index = versions.findIndex((v) => v.id === versionId);
      setCurrentIndex(index);

      // Notify all restore listeners
      restoreCallbacksRef.current.forEach((callback) => {
        callback(version.nodes, version.edges);
      });

      // ✅ No new version creation - simply move to the selected version
      // This makes Restore consistent with Undo/Redo behavior

      updateStorageStats();

      console.info(`Version restored: ${versionId}`);
    } else {
      console.error(`Failed to restore version: ${versionId}`);
    }
  };

  /**
   * Delete a specific version
   */
  const deleteVersion = (versionId: string) => {
    const success = workflowVersionStorage.delete(versionId);

    if (success) {
      // Reload versions
      const allVersions = workflowVersionStorage.getAllVersions();
      setVersions(allVersions);

      // Update current version if needed
      const current = workflowVersionStorage.getCurrentVersion();
      setCurrentVersion(current);

      // Update current index
      if (current) {
        const index = allVersions.findIndex((v) => v.id === current.id);
        setCurrentIndex(index);
      }

      updateStorageStats();

      console.info(`Version deleted: ${versionId}`);
    } else {
      console.error(`Failed to delete version: ${versionId}`);
    }
  };

  /**
   * Clear all version history
   */
  const clearVersion = () => {
    const success = workflowVersionStorage.clear();

    if (success) {
      setVersions([]);
      setCurrentVersion(null);
      setCurrentIndex(-1);
      updateStorageStats();

      console.info("Version history cleared");
    } else {
      console.error("Failed to clear version history");
    }
  };

  /**
   * Compare two versions
   */
  const compareVersion = useCallback(
    (fromId: string, toId: string): VersionDiff | null => {
      const fromVersion = versions.find((v) => v.id === fromId);
      const toVersion = versions.find((v) => v.id === toId);

      if (!fromVersion || !toVersion) {
        return null;
      }

      // Calculate diff
      const addedNodes = toVersion.nodes.filter(
        (node) => !fromVersion.nodes.find((n) => n.id === node.id),
      );

      const removedNodes = fromVersion.nodes.filter(
        (node) => !toVersion.nodes.find((n) => n.id === node.id),
      );

      const addedEdges = toVersion.edges.filter(
        (edge) => !fromVersion.edges.find((e) => e.id === edge.id),
      );

      const removedEdges = fromVersion.edges.filter(
        (edge) => !toVersion.edges.find((e) => e.id === edge.id),
      );

      const modifiedNodes = toVersion.nodes
        .map((toNode) => {
          const fromNode = fromVersion.nodes.find((n) => n.id === toNode.id);
          if (fromNode && JSON.stringify(fromNode) !== JSON.stringify(toNode)) {
            return { before: fromNode, after: toNode };
          }
          return null;
        })
        .filter((item): item is { before: WorkflowNode; after: WorkflowNode } =>
          Boolean(item),
        );

      return {
        added: { nodes: addedNodes, edges: addedEdges },
        removed: { nodes: removedNodes, edges: removedEdges },
        modified: { nodes: modifiedNodes },
      };
    },
    [versions],
  );

  /**
   * Undo - go to previous version
   */
  const undo = () => {
    if (currentIndex < versions.length - 1) {
      const previousVersion = versions[currentIndex + 1];
      if (previousVersion) {
        setCurrentVersion(previousVersion);
        setCurrentIndex(currentIndex + 1);

        // Notify listeners
        restoreCallbacksRef.current.forEach((callback) => {
          callback(previousVersion.nodes, previousVersion.edges);
        });

        console.info(`Undo to version: ${previousVersion.id}`);
      }
    }
  };

  /**
   * Redo - go to next version
   */
  const redo = () => {
    if (currentIndex > 0) {
      const nextVersion = versions[currentIndex - 1];
      if (nextVersion) {
        setCurrentVersion(nextVersion);
        setCurrentIndex(currentIndex - 1);

        // Notify listeners
        restoreCallbacksRef.current.forEach((callback) => {
          callback(nextVersion.nodes, nextVersion.edges);
        });

        console.info(`Redo to version: ${nextVersion.id}`);
      }
    }
  };

  /**
   * Register a restore callback
   */
  const registerOnRestore = useCallback((handler: OnRestoreCallback) => {
    restoreCallbacksRef.current.add(handler);

    // Return cleanup function
    return () => {
      restoreCallbacksRef.current.delete(handler);
    };
  }, []);

  /**
   * Open history panel
   */
  const open = useCallback(() => {
    setShow(true);
  }, []);

  /**
   * Close history panel
   */
  const close = useCallback(() => {
    setShow(false);
  }, []);

  // Computed values
  const canUndo = currentIndex < versions.length - 1;
  const canRedo = currentIndex > 0;

  const value: WorkflowVersioningContextValue = {
    currentVersion,
    versions,
    show,
    canUndo,
    canRedo,
    storageStats,
    open,
    close,
    undo,
    redo,
    save: saveVersion,
    restore: restoreVersion,
    delete: deleteVersion,
    clear: clearVersion,
    compare: compareVersion,
    registerOnRestore,
  };

  return (
    <WorkflowVersioningContext.Provider value={value}>
      {children}

      <VersionHistoryPanel
        show={show}
        versions={versions}
        currentVersion={currentVersion}
        storageStats={storageStats}
        onClose={close}
        onRestore={restoreVersion}
        onDelete={deleteVersion}
        onClearAll={clearVersion}
      />
    </WorkflowVersioningContext.Provider>
  );
}

/**
 * Hook to use WorkflowVersioning context
 */
export function useWorkflowVersioning(handlers?: {
  onRestore: OnRestoreCallback;
}): Omit<WorkflowVersioningContextValue, "registerOnRestore"> {
  const context = use(WorkflowVersioningContext);

  if (!context) {
    throw new Error(
      "useWorkflowVersioning must be used within WorkflowVersioningProvider",
    );
  }

  const { registerOnRestore, ...rest } = context;

  useEffect(() => {
    const unregisterFns: (() => void)[] = [];

    console.log(handlers);
    if (handlers?.onRestore) {
      unregisterFns.push(registerOnRestore(handlers?.onRestore));
    }

    return () => {
      unregisterFns.forEach((fn) => fn());
    };
  }, []);

  return rest;
}
