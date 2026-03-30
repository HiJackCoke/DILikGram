import {
  Square,
  Sparkles,
  History,
  TestTube,
  FlaskConical,
  Beaker,
  Monitor,
  Loader2,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import toast from "@/components/ui/Toast";
import { useWorkflowExecution } from "@/contexts/WorkflowExecution";
import { useWorkflowGenerator } from "@/contexts/WorkflowGenerator";
import { useWorkflowVersioning } from "@/contexts/WorkflowVersioning";
import { useUIPreview } from "@/contexts/UIPreview";

import UndoRedoButtons from "./UndoRedoButtons";

import type { ExecutionData, WorkflowEdge, WorkflowNode } from "@/types";
import type { Dispatch, SetStateAction } from "react";
import { Switch } from "@/components/ui/Switch";

interface Props {
  nodes: WorkflowNode[];
  setNodes: Dispatch<SetStateAction<WorkflowNode[]>>;
  setEdges: Dispatch<SetStateAction<WorkflowEdge[]>>;
  /** Called when the user clicks "View UI" (used for onboarding guide tracking) */
  onViewUIClick?: () => void;
}

export default function ExecutionHeader({ nodes, setNodes, setEdges, onViewUIClick }: Props) {
  const { open: openGenerator } = useWorkflowGenerator();
  const { open: openHistory, currentVersion } = useWorkflowVersioning();
  const generationMeta = currentVersion?.generationMeta ?? null;
  const { open: openUIPreview } = useUIPreview();
  const router = useRouter();
  const [isGeneratingUI, setIsGeneratingUI] = useState(false);

  useEffect(() => {
    if (!isGeneratingUI) return;

    // Push a dummy history entry so the back button fires popstate instead of navigating
    window.history.pushState(null, "", window.location.href);

    const handlePopState = async () => {
      // Re-push to hold position while the dialog is open
      window.history.pushState(null, "", window.location.href);
      const confirmed = await dialog.confirm(
        "Leave page?",
        "UI generation is in progress. Leaving now will cancel it.",
      );
      if (confirmed) {
        // Go back 2 entries: the re-push above + the dummy entry
        window.history.go(-2);
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isGeneratingUI]);

  const handleNodeUpdate = (nodeId: string, executionData: ExecutionData) => {
    setNodes((prevNodes) =>
      prevNodes.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, execution: executionData } }
          : node,
      ),
    );
  };

  const handleEdgeUpdate = (
    edgeId: string,
    data: Partial<WorkflowEdge["data"]>,
  ) => {
    setEdges((prevEdges) =>
      prevEdges.map((edge) =>
        edge.id === edgeId
          ? { ...edge, data: { ...edge.data, ...data } }
          : edge,
      ),
    );
  };
  const {
    isExecuting,
    executionState,
    isSimulated,
    stopExecution,
    setIsSimulated,
  } = useWorkflowExecution({
    onNodeUpdate: handleNodeUpdate,
    onEdgeUpdate: handleEdgeUpdate,
  });

  const selectedNodeId = nodes.find((node) => node.selected)?.id;
  const executedCount = nodes.filter(
    (n) => n.data.execution?.state === "executed",
  ).length;

  return (
    <div className="absolute top-4 left-20 z-10 space-y-3">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">
            Workflow Builder
          </h1>
          <p className="text-slate-400 text-sm">
            Click a Start node to execute its flow
          </p>
        </div>

        <Switch
          palette="warning"
          variant="icon"
          label="REAL"
          checkedLabel="SIM"
          icon={<FlaskConical className="text-white" />}
          checkedIcon={<Beaker className="text-white" />}
          disabled={isExecuting}
          checked={isSimulated}
          onChange={(_, checked) => setIsSimulated(checked)}
        />
      </div>

      {/* Execution Controls */}
      <div className="flex items-center gap-2">
        {/* AI Generate Button */}
        <Button
          palette="primary"
          icon={<Sparkles />}
          iconPosition="left"
          onClick={openGenerator}
          disabled={isExecuting}
          data-tutorial="generate-btn"
        >
          Generate with AI
        </Button>

        {/* View UI Preview Button */}
        {generationMeta && (
          <Button
            palette="secondary"
            variant="solid"
            icon={
              isGeneratingUI ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Monitor />
              )
            }
            iconPosition="left"
            data-tutorial="view-ui-btn"
            onClick={async () => {
              setIsGeneratingUI(true);
              onViewUIClick?.();
              try {
                const generated = await openUIPreview({
                  nodes,
                  analysisResult: generationMeta.analysisResult,
                  sampleId: generationMeta.sampleId,
                  versionId: currentVersion?.id,
                });
                if (generated) {
                  toast.success("UI generated! Click to view", () =>
                    router.push("/workflow/ui-preview"),
                  );
                } else {
                  router.push("/workflow/ui-preview");
                }
              } finally {
                setIsGeneratingUI(false);
              }
            }}
            disabled={isExecuting || isGeneratingUI}
          >
            {isGeneratingUI ? "생성 중..." : "View UI"}
          </Button>
        )}

        {/* History Button */}
        <Button
          palette="secondary"
          variant="outline"
          icon={<History />}
          iconPosition="left"
          onClick={openHistory}
          disabled={isExecuting}
        >
          History
        </Button>

        {/* Undo/Redo Buttons */}
        <UndoRedoButtons />

        {/* Stop Button */}
        {isExecuting && (
          <Button
            palette="warning"
            icon={<Square />}
            iconPosition="left"
            onClick={stopExecution}
          >
            중단
          </Button>
        )}
      </div>

      {/* Simulation Mode Indicator */}
      {isSimulated && !isExecuting && (
        <div className="px-3 py-1.5 bg-yellow-600/90 border border-yellow-500 text-white rounded-lg text-sm flex items-center gap-2">
          <TestTube className="w-4 h-4" />
          <span className="font-semibold">SIMULATION MODE</span>
          <span className="text-yellow-200 text-xs">
            Mock responses enabled
          </span>
        </div>
      )}

      {/* Status */}
      {isExecuting &&
        (() => {
          const currentNode = nodes.find(
            (n) => n.data.execution?.state === "executing",
          );
          return currentNode ? (
            <div className="px-3 py-1.5 bg-blue-600/90 text-white rounded-lg text-sm">
              실행 중: <span className="font-semibold">{currentNode.id}</span>
            </div>
          ) : null;
        })()}

      {selectedNodeId && !isExecuting && (
        <div className="px-3 py-1.5 bg-purple-600/90 text-white rounded-lg text-sm">
          선택된 노드: <span className="font-semibold">{selectedNodeId}</span>
        </div>
      )}

      {/* Execution Statistics */}

      {executedCount > 0 && (
        <div className="px-3 py-2 bg-slate-800/90 border border-slate-700 text-white rounded-lg text-sm space-y-1">
          <div className="font-semibold text-slate-300 mb-1.5">실행 통계</div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">완료된 노드:</span>
            <span className="font-semibold text-palette-success-color">
              {executionState.context.outputs.size}
            </span>
          </div>
          {executionState.context.errors.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-slate-400">에러:</span>
              <span className="font-semibold text-palette-danger-color">
                {executionState.context.errors.size}
              </span>
            </div>
          )}
          {executionState.context.startTime > 0 &&
            executionState.context.endTime && (
              <div className="flex items-center gap-2">
                <span className="text-slate-400">실행 시간:</span>
                <span className="font-semibold text-palette-primary-color">
                  {(
                    (executionState.context.endTime -
                      executionState.context.startTime) /
                    1000
                  ).toFixed(2)}
                </span>
              </div>
            )}
        </div>
      )}
    </div>
  );
}
