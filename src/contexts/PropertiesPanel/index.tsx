"use client";

import {
  createContext,
  useState,
  useCallback,
  useRef,
  use,
  useEffect,
} from "react";
import type { ReactNode } from "react";
import PropertiesPanelModal from "@/contexts/PropertiesPanel/Sidebar";
import type { WorkflowNode } from "@/types/nodes";

import type {
  PropertiesPanelState,
  PropertiesOnSave,
  PropertiesOnDelete,
  PropertiesPanelHandlers,
} from "./type";
import type { Edge } from "react-cosmos-diagram";

interface PropertiesPanelContextValue {
  registerOnSave: (callback: PropertiesOnSave) => () => void;
  registerOnDelete: (callback: PropertiesOnDelete) => () => void;
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
  const deleteListeners = useRef<PropertiesOnDelete[]>([]);

  const [show, setShow] = useState(false);
  const [state, setState] = useState<PropertiesPanelState | null>(null);
  const [edges, setEdges] = useState<Edge[]>([]);

  const updateEdges = (edges: Edge[]) => {
    setEdges(edges);
  };

  const open = useCallback((node: WorkflowNode) => {
    setShow(true);
    setState({
      nodeId: node.id,
      node,
    });
  }, []);

  const close = useCallback(() => {
    setShow(false);
    setState(null);
  }, []);

  const registerOnSave = useCallback((handler: PropertiesOnSave) => {
    listeners.current.push(handler);

    return () => {
      listeners.current = listeners.current.filter(
        (listener) => listener !== handler,
      );
    };
  }, []);

  const registerOnDelete = useCallback((handler: PropertiesOnDelete) => {
    deleteListeners.current.push(handler);

    return () => {
      deleteListeners.current = deleteListeners.current.filter(
        (listener) => listener !== handler,
      );
    };
  }, []);

  const handleSave = useCallback(
    (data: Partial<WorkflowNode["data"]>) => {
      if (!state?.nodeId) return;
      close();
      listeners.current.forEach((listener) => listener(state.nodeId, data));
    },
    [state, close],
  );

  const handleDelete = useCallback(
    (nodeId: string) => {
      close();
      deleteListeners.current.forEach((listener) => listener(nodeId));
    },
    [close],
  );

  return (
    <PropertiesPanelContext
      value={{ open, close, updateEdges, registerOnSave, registerOnDelete }}
    >
      {children}

      <PropertiesPanelModal
        node={state?.node}
        edges={edges}
        open={show}
        onSave={handleSave}
        onDelete={handleDelete}
        onClose={close}
      />
    </PropertiesPanelContext>
  );
}

// Hook exported separately to satisfy react-refresh rules

export function usePropertiesPanel(handlers?: PropertiesPanelHandlers) {
  const context = use(PropertiesPanelContext);
  if (!context) {
    throw new Error(
      "usePropertiesPanel must be used within PropertiesPanelProvider",
    );
  }
  const { registerOnSave, registerOnDelete } = context;

  useEffect(() => {
    const unregisterFns: (() => void)[] = [];

    if (handlers?.onSave) {
      unregisterFns.push(registerOnSave(handlers.onSave));
    }

    if (handlers?.onDelete) {
      unregisterFns.push(registerOnDelete(handlers.onDelete));
    }

    return () => {
      unregisterFns.forEach((fn) => fn());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return context;
}
