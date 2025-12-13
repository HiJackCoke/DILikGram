import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
} from "react";
import type { ReactNode } from "react";
import PropertiesPanelModal from "@/components/PropertiesPanel";
import type { WorkflowNode } from "@/types/nodes";

import type { PropertiesPanelState, PropertiesOnSave } from "./type";
import type { Edge } from "react-cosmos-diagram";

interface PropertiesPanelContextValue {
  registerOnSave: (callback: PropertiesOnSave) => void;
  updateEdges: (edges: Edge[]) => void;
  open: (node: WorkflowNode) => void;
  close: () => void;
}

interface PropertiesPanelProviderProps {
  children: ReactNode;
}

const PropertiesPanelContext =
  createContext<PropertiesPanelContextValue | null>(null);

export function PropertiesPanelProvider({
  children,
}: PropertiesPanelProviderProps) {
  const listeners = useRef<PropertiesOnSave[]>([]);

  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useState<PropertiesPanelState | null>(null);
  const [edges, setEdges] = useState<Edge[]>([]);

  const updateEdges = (edges: Edge[]) => {
    setEdges(edges);
  };

  const open = useCallback((node: WorkflowNode) => {
    setIsOpen(true);
    setState({
      nodeId: node.id,
      node,
    });
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setState(null);
  }, []);

  const registerOnSave = useCallback((handler: PropertiesOnSave) => {
    listeners.current.push(handler);

    return () => {
      listeners.current = listeners.current.filter(
        (listener) => listener !== handler
      );
    };
  }, []);

  const handleSave = useCallback(
    (data: Partial<WorkflowNode["data"]>) => {
      if (!state?.nodeId) return;
      close();
      listeners.current.forEach((listener) => listener(state.nodeId, data));
    },
    [state, close]
  );

  return (
    <PropertiesPanelContext.Provider
      value={{ open, close, updateEdges, registerOnSave }}
    >
      {children}

      <PropertiesPanelModal
        node={state?.node}
        edges={edges}
        open={isOpen}
        onSave={handleSave}
        onClose={close}
      />
    </PropertiesPanelContext.Provider>
  );
}

// Hook exported separately to satisfy react-refresh rules

export function usePropertiesPanelContext() {
  const context = useContext(PropertiesPanelContext);
  if (!context) {
    throw new Error(
      "usePropertiesPanelContext must be used within PropertiesPanelProvider"
    );
  }
  return context;
}
