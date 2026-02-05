/**
 * VersionHistoryPanel - Right-side drawer for workflow version management
 *
 * Displays version history with restore/delete functionality
 * Pattern: PropertiesPanel (Provider-rendered, CSS transitions, no Portal)
 */

import { ReactNode, useState } from "react";
import {
  History,
  X,
  Star,
  Trash2,
  RotateCcw,
  Sparkles,
  Edit3,
  FileText,
  RotateCw,
  AlertCircle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Button from "@/components/Button";
import type { WorkflowVersion, ChangeType } from "@/types/version";
import { WorkflowVersioningContextValue } from "../type";

/**
 * Props for VersionHistoryPanel
 */
interface VersionHistoryPanelProps
  extends Pick<
    WorkflowVersioningContextValue,
    "show" | "versions" | "currentVersion" | "storageStats"
  > {
  onClose: WorkflowVersioningContextValue["close"];
  onRestore: WorkflowVersioningContextValue["restore"];
  onDelete: WorkflowVersioningContextValue["delete"];
  onClearAll: WorkflowVersioningContextValue["clear"];
}

/**
 * Get icon and color for change type
 */
function getChangeTypeDisplay(changeType: ChangeType): {
  icon: ReactNode;
  label: string;
  color: string;
} {
  switch (changeType) {
    case "initial":
      return {
        icon: <FileText className="w-3 h-3" />,
        label: "Initial",
        color: "bg-gray-100 text-gray-700",
      };
    case "generated":
      return {
        icon: <Sparkles className="w-3 h-3" />,
        label: "Generated",
        color: "bg-palette-primary-bg text-white",
      };
    case "edited":
      return {
        icon: <Edit3 className="w-3 h-3" />,
        label: "Edited",
        color: "bg-palette-warning-bg text-white",
      };
    case "manual":
      return {
        icon: <Edit3 className="w-3 h-3" />,
        label: "Manual",
        color: "bg-palette-secondary-bg text-white",
      };
    case "restored":
      return {
        icon: <RotateCw className="w-3 h-3" />,
        label: "Restored",
        color: "bg-palette-success-bg text-white",
      };
  }
}

/**
 * Version Card Component
 */
function VersionCard({
  version,
  isCurrent,
  onRestore,
  onDelete,
}: {
  version: WorkflowVersion;
  isCurrent: boolean;
  onRestore: (versionId: string) => void;
  onDelete: (versionId: string) => void;
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { icon, label, color } = getChangeTypeDisplay(
    version.metadata.changeType,
  );

  const handleRestore = () => {
    if (
      confirm(
        "Restore this version? This will create a new version from this snapshot.",
      )
    ) {
      onRestore(version.id);
    }
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    onDelete(version.id);
    setShowDeleteConfirm(false);
  };

  return (
    <div
      className={`border rounded-lg p-3 transition-all ${
        isCurrent
          ? "border-palette-primary-border bg-palette-primary-bg/5 shadow-sm"
          : "border-gray-200 bg-white hover:shadow-sm"
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          {isCurrent && (
            <Star className="w-4 h-4 text-palette-primary-border fill-palette-primary-border" />
          )}
          <span className="text-xs text-gray-500">
            {formatDistanceToNow(version.timestamp, { addSuffix: true })}
          </span>
        </div>
        <div className={`flex items-center gap-1 px-2 py-0.5 rounded ${color}`}>
          {icon}
          <span className="text-xs font-medium">{label}</span>
        </div>
      </div>

      {/* Description */}
      {version.metadata.description && (
        <p className="text-sm text-gray-700 mb-2 line-clamp-2">
          {version.metadata.description}
        </p>
      )}

      {/* AI Metadata */}
      {version.metadata.aiGenerated && (
        <div className="mb-2 p-2 bg-blue-50 rounded border border-blue-100">
          <p className="text-xs text-blue-700 line-clamp-1">
            Prompt: {version.metadata.aiGenerated.prompt}
          </p>
          {version.metadata.aiGenerated.complexity && (
            <span className="text-xs text-blue-600">
              Complexity: {version.metadata.aiGenerated.complexity}
            </span>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
        <span>{version.metadata.stats.nodeCount} nodes</span>
        <span>•</span>
        <span>{version.metadata.stats.edgeCount} edges</span>
      </div>

      {/* Actions */}
      {!isCurrent && !showDeleteConfirm && (
        <div className="flex items-center gap-2">
          <Button
            palette="primary"
            variant="outline"
            icon={<RotateCcw className="w-3.5 h-3.5" />}
            iconPosition="left"
            onClick={handleRestore}
            className="text-xs flex-1"
          >
            Restore
          </Button>
          <Button
            palette="danger"
            variant="outline"
            icon={<Trash2 className="w-3.5 h-3.5" />}
            onClick={handleDelete}
            className="text-xs"
          />
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded">
          <AlertCircle className="w-4 h-4 text-palette-danger-border shrink-0" />
          <span className="text-xs text-red-700 flex-1">Delete version?</span>
          <div className="flex gap-1">
            <Button
              palette="danger"
              onClick={confirmDelete}
              className="text-xs px-2 py-1"
            >
              Yes
            </Button>
            <Button
              palette="secondary"
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
              className="text-xs px-2 py-1"
            >
              No
            </Button>
          </div>
        </div>
      )}

      {/* Current Badge */}
      {isCurrent && (
        <div className="mt-2 pt-2 border-t border-palette-primary-border/20">
          <span className="text-xs font-medium text-palette-primary-border">
            ⭐ Current Version
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * VersionHistoryPanel Component (PropertiesPanel Pattern)
 */
export default function VersionHistoryPanel({
  show,
  versions,
  currentVersion,
  storageStats,
  onClose,
  onRestore,
  onDelete,
  onClearAll,
}: VersionHistoryPanelProps) {
  const handleClearAll = () => {
    if (
      confirm(
        "Clear all version history? This action cannot be undone.\n\nAll saved versions will be permanently deleted.",
      )
    ) {
      onClearAll();
      onClose();
    }
  };

  // Safe check for storageStats
  const showStorageWarning =
    storageStats?.versionCount &&
    storageStats.versionCount >= (storageStats.warningThreshold || 40);

  return (
    <>
      {/* Backdrop - CSS로 조건부 표시 */}
      <div
        className={`
          fixed inset-0 bg-black/30 z-[998]
          transition-opacity duration-300
          ${show ? "opacity-100" : "opacity-0 pointer-events-none"}
        `}
        onClick={onClose}
      />

      {/* Drawer - CSS transition으로 슬라이드 */}
      <div
        className={`
          fixed right-0 top-0 h-full w-[400px] max-w-[90vw]
          bg-white shadow-2xl z-[999] flex flex-col
          transition-transform duration-300 ease-out
          ${show ? "translate-x-0" : "translate-x-full"}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-palette-primary-bg rounded">
              <History className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Version History
              </h2>
              <p className="text-xs text-gray-500">
                {versions.length} version{versions.length !== 1 ? "s" : ""}{" "}
                saved
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Storage Warning */}
        {showStorageWarning && storageStats && (
          <div className="mx-4 mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
            <div className="text-xs text-yellow-700">
              <p className="font-medium">Storage approaching limit</p>
              <p className="mt-1">
                {storageStats.versionCount} / 50 versions (
                {storageStats.currentSizeMB?.toFixed(2) || 0} MB used)
              </p>
            </div>
          </div>
        )}

        {/* Version List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {versions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <History className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-gray-500 text-sm">No versions saved yet</p>
              <p className="text-gray-400 text-xs mt-1">
                Versions will appear here when you generate or edit workflows
              </p>
            </div>
          ) : (
            versions.map((version) => (
              <VersionCard
                key={version.id}
                version={version}
                isCurrent={currentVersion?.id === version.id}
                onRestore={onRestore}
                onDelete={onDelete}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          {storageStats && (
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs text-gray-600">
                <div className="font-medium">
                  {storageStats.versionCount || 0} / 50 versions
                </div>
                <div className="text-gray-500">
                  {storageStats.currentSizeMB?.toFixed(2) || 0} MB /{" "}
                  {storageStats.maxSizeMB || 5} MB used
                </div>
              </div>
            </div>
          )}
          <Button
            palette="danger"
            variant="outline"
            icon={<Trash2 className="w-3.5 h-3.5" />}
            iconPosition="left"
            onClick={handleClearAll}
            disabled={versions.length === 0}
            className="w-full text-sm"
          >
            Clear All History
          </Button>
        </div>
      </div>
    </>
  );
}
