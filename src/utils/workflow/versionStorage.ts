/**
 * Workflow Version Storage Layer
 *
 * Manages localStorage CRUD operations for workflow version history
 * with automatic cleanup and capacity management.
 */

import { v4 as uuid } from "uuid";
import type {
  WorkflowVersion,
  WorkflowVersionHistory,
  VersionMetadata,
} from "@/types/version";
import type { WorkflowNode } from "@/types/nodes";
import type { WorkflowEdge } from "@/types/edges";

/**
 * Storage limits and configuration
 */
export const VERSION_LIMITS = {
  MAX_VERSIONS: 50, // Maximum versions to keep
  WARNING_THRESHOLD: 40, // Warn when approaching limit
  CLEANUP_COUNT: 10, // Number of old versions to delete when limit reached
  MAX_STORAGE_MB: 5, // Maximum localStorage size in MB
  EMERGENCY_CLEANUP_MB: 2, // Target size after emergency cleanup
} as const;

const STORAGE_KEY = "workflow-version-history";
const DEFAULT_WORKFLOW_ID = "default-workflow";

/**
 * WorkflowVersionStorage - localStorage-based version management
 */
export class WorkflowVersionStorage {
  /**
   * Check if localStorage is available
   */
  private isLocalStorageAvailable(): boolean {
    try {
      const test = "__localStorage_test__";
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Calculate current storage size in MB
   */
  private getStorageSizeInMB(): number {
    if (!this.isLocalStorageAvailable()) {
      console.warn("localStorage not available");
      return 0;
    }

    let totalSize = 0;
    for (const key in localStorage) {
      if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
        totalSize += localStorage[key].length + key.length;
      }
    }
    // Convert bytes to MB (chars are ~2 bytes in UTF-16)
    return (totalSize * 2) / (1024 * 1024);
  }

  /**
   * Load version history from localStorage
   */
  loadHistory(): WorkflowVersionHistory | null {
    if (!this.isLocalStorageAvailable()) {
      console.warn("localStorage not available");
      return null;
    }

    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) {
        return null;
      }

      const history: WorkflowVersionHistory = JSON.parse(data);
      return history;
    } catch (error) {
      console.error("Failed to load version history:", error);
      // Corrupted data - reset
      this.clear();
      return null;
    }
  }

  /**
   * Save version history to localStorage
   */
  saveHistory(history: WorkflowVersionHistory): boolean {
    if (!this.isLocalStorageAvailable()) {
      console.warn("localStorage not available");
      return false;
    }

    try {
      const data = JSON.stringify(history);
      localStorage.setItem(STORAGE_KEY, data);
      return true;
    } catch (error) {
      if (error instanceof Error && error.name === "QuotaExceededError") {
        console.warn(
          "localStorage quota exceeded, attempting emergency cleanup",
        );

        // Emergency cleanup
        const cleaned = this.emergencyCleanup(history);
        if (cleaned) {
          try {
            const data = JSON.stringify(cleaned);
            localStorage.setItem(STORAGE_KEY, data);
            console.info("Emergency cleanup successful");
            return true;
          } catch {
            console.error("Emergency cleanup failed");
            return false;
          }
        }
      }

      console.error("Failed to save version history:", error);
      return false;
    }
  }

  /**
   * Create a new version
   */
  createVersion(
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
    metadata: Omit<VersionMetadata, "stats">,
  ): WorkflowVersion {
    return {
      id: uuid(),
      timestamp: Date.now(),
      nodes,
      edges,
      metadata: {
        ...metadata,
        stats: {
          nodeCount: nodes.length,
          edgeCount: edges.length,
        },
      },
    };
  }

  /**
   * Append a new version to history
   */
  appendVersion(version: WorkflowVersion): boolean {
    let history = this.loadHistory();

    if (!history) {
      // Create new history
      history = {
        versions: [version],
        currentVersionId: version.id,
        workflowId: DEFAULT_WORKFLOW_ID,
      };
    } else {
      // Add to existing history
      history.versions.unshift(version); // Add to front (newest first)
      history.currentVersionId = version.id;

      // Cleanup if needed
      if (history.versions.length > VERSION_LIMITS.MAX_VERSIONS) {
        history = this.cleanupOldVersions(history);
      }
    }

    return this.saveHistory(history);
  }

  /**
   * Get current version
   */
  getCurrentVersion(): WorkflowVersion | null {
    const history = this.loadHistory();
    if (!history) {
      return null;
    }

    return (
      history.versions.find((v) => v.id === history.currentVersionId) || null
    );
  }

  /**
   * Get all versions (newest first)
   */
  getAllVersions(): WorkflowVersion[] {
    const history = this.loadHistory();
    return history?.versions || [];
  }

  /**
   * Restore a specific version
   */
  restore(versionId: string): WorkflowVersion | null {
    const history = this.loadHistory();
    if (!history) {
      return null;
    }

    const version = history.versions.find((v) => v.id === versionId);
    if (!version) {
      console.warn(`Version ${versionId} not found`);
      return null;
    }

    // Update current version ID
    history.currentVersionId = versionId;
    this.saveHistory(history);

    return version;
  }

  /**
   * Delete a specific version
   */
  delete(versionId: string): boolean {
    const history = this.loadHistory();
    if (!history) {
      return false;
    }

    const index = history.versions.findIndex((v) => v.id === versionId);
    if (index === -1) {
      console.warn(`Version ${versionId} not found`);
      return false;
    }

    // Don't allow deleting the current version if it's the only one
    if (
      history.versions.length === 1 &&
      history.currentVersionId === versionId
    ) {
      console.warn("Cannot delete the only version");
      return false;
    }

    // Remove version
    history.versions.splice(index, 1);

    // Update current version if needed
    if (history.currentVersionId === versionId) {
      history.currentVersionId = history.versions[0]?.id || "";
    }

    return this.saveHistory(history);
  }

  /**
   * Clear all version history
   */
  clear(): boolean {
    if (!this.isLocalStorageAvailable()) {
      return false;
    }

    try {
      localStorage.removeItem(STORAGE_KEY);
      return true;
    } catch (error) {
      console.error("Failed to clear version history:", error);
      return false;
    }
  }

  /**
   * Cleanup old versions when limit is exceeded
   */
  private cleanupOldVersions(
    history: WorkflowVersionHistory,
  ): WorkflowVersionHistory {
    const { MAX_VERSIONS, CLEANUP_COUNT } = VERSION_LIMITS;

    if (history.versions.length > MAX_VERSIONS) {
      // Remove oldest versions
      const versionsToKeep = history.versions.slice(
        0,
        MAX_VERSIONS - CLEANUP_COUNT,
      );

      console.info(
        `Cleaned up ${history.versions.length - versionsToKeep.length} old versions`,
      );

      return {
        ...history,
        versions: versionsToKeep,
      };
    }

    return history;
  }

  /**
   * Emergency cleanup when storage quota is exceeded
   * Keeps only the newest 10 versions
   */
  private emergencyCleanup(
    history: WorkflowVersionHistory,
  ): WorkflowVersionHistory | null {
    try {
      const KEEP_COUNT = 10;
      const cleaned: WorkflowVersionHistory = {
        ...history,
        versions: history.versions.slice(0, KEEP_COUNT),
      };

      console.info(
        `Emergency cleanup: Reduced from ${history.versions.length} to ${KEEP_COUNT} versions`,
      );

      return cleaned;
    } catch (error) {
      console.error("Emergency cleanup failed:", error);
      return null;
    }
  }

  /**
   * Get storage statistics
   */
  getStorageStats(): {
    versionCount: number;
    currentSizeMB: number;
    maxSizeMB: number;
    warningThreshold: number;
  } {
    const history = this.loadHistory();
    return {
      versionCount: history?.versions.length || 0,
      currentSizeMB: this.getStorageSizeInMB(),
      maxSizeMB: VERSION_LIMITS.MAX_STORAGE_MB,
      warningThreshold: VERSION_LIMITS.WARNING_THRESHOLD,
    };
  }
}

// Export singleton instance
export const workflowVersionStorage = new WorkflowVersionStorage();
