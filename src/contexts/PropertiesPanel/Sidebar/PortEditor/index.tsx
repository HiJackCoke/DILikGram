import { useMemo, useCallback } from "react";
import PortEditorView from "./View";
import type { PortEditorProps, PortItem } from "./types";
import {
  generatePortId,
  assignPosition,
  getPortLimits,
  validatePorts,
} from "@/utils/portHelpers";
import type { NodePort } from "@/types/nodes";

export default function PortEditor({
  label,
  value,
  nodeType,
  edges,
  currentNodeId,
  readOnly,
  onChange,
}: PortEditorProps) {
  // Enrich ports with connected nodeId
  const enrichedPorts = useMemo((): PortItem[] => {
    return value.map((port) => {
      // Find edge connected to this port
      const connectedEdge = edges.find(
        (edge) =>
          (edge.source === currentNodeId && edge.sourcePort === port.id) ||
          (edge.target === currentNodeId && edge.targetPort === port.id)
      );

      const connectedNodeId =
        connectedEdge?.source === currentNodeId
          ? connectedEdge.target
          : connectedEdge?.target === currentNodeId
            ? connectedEdge.source
            : undefined;

      return {
        ...port,
        connectedNodeId,
      };
    });
  }, [value, edges, currentNodeId]);

  const targetPorts = enrichedPorts.filter((p) => p.type === "target");
  const sourcePorts = enrichedPorts.filter((p) => p.type === "source");

  const limits = useMemo(() => getPortLimits(nodeType), [nodeType]);

  const validation = useMemo(
    () => validatePorts(value, nodeType),
    [value, nodeType]
  );

  const canAddTarget = targetPorts.length < limits.maxTarget;
  const canAddSource = sourcePorts.length < limits.maxSource;

  const handleAddTarget = useCallback(() => {
    if (!canAddTarget) return;

    const newPort: NodePort = {
      id: `input-${Date.now()}`,
      type: "target",
      position: assignPosition("target", 0, nodeType),
      label: "Input",
    };

    onChange([...value, newPort]);
  }, [canAddTarget, value, nodeType, onChange]);

  const handleAddSource = useCallback(() => {
    if (!canAddSource) return;

    const sourceIndex = sourcePorts.length;
    const defaultLabels = nodeType === "decision" ? ["yes", "no"] : ["output"];

    const newPort: NodePort = {
      id: `${defaultLabels[sourceIndex] || "output"}-${Date.now()}`,
      type: "source",
      position: assignPosition("source", sourceIndex, nodeType),
      label: defaultLabels[sourceIndex] || "Output",
    };

    onChange([...value, newPort]);
  }, [canAddSource, sourcePorts.length, value, nodeType, onChange]);

  const handleEditLabel = useCallback(
    (portId: string, newLabel: string) => {
      const updated = value.map((port) =>
        port.id === portId
          ? {
              ...port,
              id: generatePortId(newLabel) || portId,
              label: newLabel,
            }
          : port
      );

      onChange(updated);
    },
    [value, onChange]
  );

  const handleRemove = useCallback(
    (portId: string) => {
      const updated = value.filter((port) => port.id !== portId);
      onChange(updated);
    },
    [value, onChange]
  );

  return (
    <PortEditorView
      label={label}
      targetPorts={targetPorts}
      sourcePorts={sourcePorts}
      limits={limits}
      readOnly={readOnly}
      canAddTarget={canAddTarget}
      canAddSource={canAddSource}
      validationError={validation.valid ? undefined : validation.error}
      onAddTarget={handleAddTarget}
      onAddSource={handleAddSource}
      onEditLabel={handleEditLabel}
      onRemove={handleRemove}
    />
  );
}
