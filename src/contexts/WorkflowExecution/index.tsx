import {
  createContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  use,
} from "react";
import type { ReactNode } from "react";
import { createWorkflowExecutor } from "@/utils/workflow";
import type {
  WorkflowNode,
  WorkflowEdge,
  WorkflowMode,
  WorkflowRuntimeState,
  ExecutionData,
  OnNodeUpdateCallback,
  OnEdgeUpdateCallback,
} from "@/types";
import { useStoreApi } from "react-cosmos-diagram";

/* ------------------------------------------------------------------ */
/* Types */
/* ------------------------------------------------------------------ */

interface WorkflowExecutionContextValue {
  isExecuting: boolean;
  executingStartNodeId: string | null;
  executionState: WorkflowRuntimeState;

  executeFromStartNode: (startNodeId: string) => void;
  stopExecution: () => void;
  subscribeNodeUpdate: (cb: OnNodeUpdateCallback) => () => void;
  subscribeEdgeUpdate: (cb: OnEdgeUpdateCallback) => () => void;
}

const WorkflowExecutionContext =
  createContext<WorkflowExecutionContextValue | null>(null);

/* ------------------------------------------------------------------ */
/* Provider */
/* ------------------------------------------------------------------ */

interface WorkflowExecutionProviderProps {
  children: ReactNode;
  mode?: WorkflowMode;
}

export function WorkflowExecutionProvider({
  children,
  mode = "auto",
}: WorkflowExecutionProviderProps) {
  const store = useStoreApi();

  const [executionState, setExecutionState] = useState<WorkflowRuntimeState>({
    isRunning: false,
    context: { outputs: new Map(), errors: new Map(), startTime: 0 },
  });

  const [executingStartNodeId, setExecutingStartNodeId] = useState<
    string | null
  >(null);

  const executionRef = useRef<ReturnType<typeof createWorkflowExecutor> | null>(
    null
  );

  /* -------------------------------------------------------------- */
  /* Subscriber registries */
  /* -------------------------------------------------------------- */

  const nodeSubscribers = useRef(new Set<OnNodeUpdateCallback>());
  const edgeSubscribers = useRef(new Set<OnEdgeUpdateCallback>());

  const subscribeNodeUpdate = useCallback((cb: OnNodeUpdateCallback) => {
    nodeSubscribers.current.add(cb);
    return () => nodeSubscribers.current.delete(cb);
  }, []);

  const subscribeEdgeUpdate = useCallback((cb: OnEdgeUpdateCallback) => {
    edgeSubscribers.current.add(cb);
    return () => edgeSubscribers.current.delete(cb);
  }, []);

  /* -------------------------------------------------------------- */
  /* Executor-facing handlers (single entry point) */
  /* -------------------------------------------------------------- */

  const handleNodeUpdate = useCallback(
    (nodeId: string, data: ExecutionData) => {
      nodeSubscribers.current.forEach((cb) => cb(nodeId, data));
    },
    []
  );

  const handleEdgeUpdate = useCallback(
    (edgeId: string, data: Partial<WorkflowEdge["data"]>) => {
      edgeSubscribers.current.forEach((cb) => cb(edgeId, data));
    },
    []
  );

  /* -------------------------------------------------------------- */
  /* Execution control */
  /* -------------------------------------------------------------- */

  const executeFromStartNode = useCallback(
    (startNodeId: string) => {
      if (executionState.isRunning) return;

      setExecutingStartNodeId(startNodeId);

      executionRef.current = createWorkflowExecutor({
        nodes: store.getState().getNodes() as WorkflowNode[],
        edges: store.getState().edges,
        mode,
        startNodeId,
        onStateChange: (state) => {
          setExecutionState(state);
          if (!state.isRunning) {
            setExecutingStartNodeId(null);
          }
        },
        onNodeUpdate: handleNodeUpdate,
        onEdgeUpdate: handleEdgeUpdate,
      });

      executionRef.current.execute();
    },
    [executionState.isRunning, store, mode, handleNodeUpdate, handleEdgeUpdate]
  );

  const stopExecution = useCallback(() => {
    executionRef.current?.abort();
    setExecutionState({
      isRunning: false,
      context: { outputs: new Map(), errors: new Map(), startTime: 0 },
    });
    setExecutingStartNodeId(null);
  }, []);

  /* -------------------------------------------------------------- */
  /* Context value */
  /* -------------------------------------------------------------- */

  return (
    <WorkflowExecutionContext
      value={{
        isExecuting: executionState.isRunning,
        executingStartNodeId,
        executionState,
        executeFromStartNode,
        stopExecution,
        subscribeNodeUpdate,
        subscribeEdgeUpdate,
      }}
    >
      {children}
    </WorkflowExecutionContext>
  );
}

/* ------------------------------------------------------------------ */
/* Hook */
/* ------------------------------------------------------------------ */

export function useWorkflowExecution(options?: {
  onNodeUpdate?: OnNodeUpdateCallback;
  onEdgeUpdate?: OnEdgeUpdateCallback;
}) {
  const context = use(WorkflowExecutionContext);

  if (!context) {
    throw new Error(
      "useWorkflowExecution must be used within WorkflowExecutionProvider"
    );
  }

  const { subscribeNodeUpdate, subscribeEdgeUpdate, ...api } = context;

  useEffect(() => {
    if (!options?.onNodeUpdate) return;
    return subscribeNodeUpdate(options.onNodeUpdate);
  }, [options?.onNodeUpdate, subscribeNodeUpdate]);

  useEffect(() => {
    if (!options?.onEdgeUpdate) return;
    return subscribeEdgeUpdate(options.onEdgeUpdate);
  }, [options?.onEdgeUpdate, subscribeEdgeUpdate]);

  return api;
}
