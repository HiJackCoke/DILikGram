import { createContext, useContext, useState, useCallback } from "react";
import type { ReactNode } from "react";
import type { ExecutorConfig } from "@/types/executor";
import ExecutorEditorModal from "@/components/ExecutorEditor";
import type { WorkflowNode, WorkflowNodeType } from "@/types/nodes";

export interface ExecutorEditorState {
  nodeId: string;
  nodeType: WorkflowNodeType;
  initialConfig?: ExecutorConfig;
}

interface ExecutorEditorContextValue {
  open: (nodeId: string) => void;
  close: () => void;
}

interface ExecutorEditorProviderProps {
  children: ReactNode;
  nodes: WorkflowNode[];
  onSave: (nodeId: string, config: ExecutorConfig) => void;
}

const ExecutorEditorContext = createContext<ExecutorEditorContextValue | null>(
  null
);

export function ExecutorEditorProvider({
  children,
  nodes,
  onSave,
}: ExecutorEditorProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useState<ExecutorEditorState | null>(null);

  const open = useCallback(
    (nodeId: string) => {
      const currentNode = nodes.find((n) => n.id === nodeId);
      const initialConfig = currentNode?.data?.executor?.config;

      if (!currentNode?.type) return;

      setIsOpen(true);
      setState({
        nodeId,
        nodeType: currentNode?.type,
        initialConfig,
      });
    },
    [nodes]
  );

  const close = useCallback(() => {
    setIsOpen(false);
    setState(null);
  }, []);

  const handleSave = useCallback(
    (config: ExecutorConfig) => {
      if (state?.nodeId) {
        onSave(state.nodeId, config);
        close();
      }
    },
    [state, onSave, close]
  );

  return (
    <ExecutorEditorContext.Provider value={{ open, close }}>
      {children}

      <ExecutorEditorModal
        {...state}
        key={state?.nodeId}
        open={isOpen}
        onSave={handleSave}
        onClose={close}
      />
    </ExecutorEditorContext.Provider>
  );
}

// Hook exported separately to satisfy react-refresh rules
// eslint-disable-next-line react-refresh/only-export-components
export function useExecutorEditorContext() {
  const context = useContext(ExecutorEditorContext);
  if (!context) {
    throw new Error(
      "useExecutorEditorContext must be used within ExecutorEditorProvider"
    );
  }
  return context;
}
