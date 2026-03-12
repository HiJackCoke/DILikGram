import {
  Square,
  Sparkles,
  History,
  TestTube,
  FlaskConical,
  Beaker,
} from "lucide-react";
import Button from "@/components/ui/Button";
import { useWorkflowExecution } from "@/contexts/WorkflowExecution";
import { useWorkflowGenerator } from "@/contexts/WorkflowGenerator";
import { useWorkflowVersioning } from "@/contexts/WorkflowVersioning";
import UndoRedoButtons from "./UndoRedoButtons";

import { useState } from "react";
import type { ExecutionData, WorkflowEdge, WorkflowNode } from "@/types";
import type { Dispatch, SetStateAction } from "react";
import { Switch } from "@/components/ui/Switch";

interface Props {
  nodes: WorkflowNode[];

  setNodes: Dispatch<SetStateAction<WorkflowNode[]>>;
  setEdges: Dispatch<SetStateAction<WorkflowEdge[]>>;
}

export default function ExecutionHeader({ nodes, setNodes, setEdges }: Props) {
  const [simulationMode, setSimulationMode] = useState(true); // Default: simulation mode
  const { open: openGenerator } = useWorkflowGenerator();
  const { open: openHistory } = useWorkflowVersioning();
  const handleNodeUpdate = (nodeId: string, executionData: ExecutionData) => {
    console.log(nodeId, executionData);
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
  const { isExecuting, executionState, stopExecution } = useWorkflowExecution({
    simulationMode,
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
          label="REAL"
          variant="icon"
          checkedLabel="SIM"
          disabled={isExecuting}
          palette="warning"
          checked={simulationMode}
          icon={<FlaskConical className="text-white" />}
          checkedIcon={<Beaker className="text-white" />}
          onChange={(_, checked) => setSimulationMode(checked)}
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
        >
          Generate with AI
        </Button>

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
      {simulationMode && !isExecuting && (
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
