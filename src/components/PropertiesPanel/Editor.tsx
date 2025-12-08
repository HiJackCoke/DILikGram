import { useState, useEffect, useMemo } from "react";

import Input from "@/components/Input";
import TextArea from "@/components/TextArea";
import Select from "@/components/Select";
import KeyValueEditor from "@/components/KeyValueEditor";
import Tabs from "@/components/Tabs";
import PortEditor from "@/components/PortEditor";

import { getFieldConfig } from "@/utils/formFieldInference";
import { generateFunctionCodeFromPanel } from "@/utils/executorHelpers";

import type { WorkflowNode, NodePort } from "@/types/nodes";
import type { WorkflowEdge } from "@/types/edges";
import type { FieldConfig, TabOption } from "@/types/editor";
import type { KeysOfUnion } from "@/types/utils";

interface DynamicNodeEditorProps {
  node: WorkflowNode;
  edges: WorkflowEdge[];
  onSave: (data: Partial<WorkflowNode["data"]>) => void;
}

export default function DynamicNodeEditor({
  node,
  edges,
  onSave,
}: DynamicNodeEditorProps) {
  const [formData, setFormData] = useState<Record<string, unknown>>({});

  // Compute initial data from node.data using useMemo
  const initialData = useMemo(() => {
    const data: Record<string, unknown> = {};
    Object.entries(node.data).forEach(([key, value]) => {
      // Exclude readOnly fields
      if (!node.type) return;
      const fieldConfig = getFieldConfig(node.type, key);
      if (fieldConfig) {
        data[key] = value;
      }
    });
    return data;
  }, [node.data, node.type]);

  // Sync formData when initialData changes
  useEffect(() => {
    setFormData(initialData);
  }, [initialData]);

  const handleFieldChange = (key: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    // For ServiceNode in Panel Mode, auto-generate functionCode
    if (node.type === "service") {
      const functionCode = generateFunctionCodeFromPanel(formData);

      // Save with generated code
      onSave({
        ...formData,
        executor: {
          ...node.data.executor,
          config: {
            ...node.data.executor?.config,
            functionCode,
            lastModified: Date.now(),
          },
        },
      } as Partial<WorkflowNode["data"]>);
      return;
    }

    // Normal save for other nodes or Code Mode ServiceNode
    onSave(formData as Partial<WorkflowNode["data"]>);
  };

  const renderFieldByConfig = (
    config: FieldConfig & { key?: string },
    fieldKey: KeysOfUnion<WorkflowNode["data"]>
  ) => {
    const fieldValue =
      formData[fieldKey] ?? node.data[fieldKey as keyof typeof node.data];

    switch (config.type) {
      case "text":
        return (
          <Input
            key={fieldKey}
            label={config.label}
            readOnly={config.readOnly}
            disabled={config.disabled}
            value={String(fieldValue ?? "")}
            onChange={(v) => handleFieldChange(fieldKey, v)}
            placeholder={config.placeholder}
          />
        );

      case "number":
        return (
          <Input
            key={fieldKey}
            type={config.type}
            readOnly={config.readOnly}
            disabled={config.disabled}
            formatNumber={config.type === "number"}
            label={config.label}
            value={Number(fieldValue ?? 0)}
            onChange={(v) => handleFieldChange(fieldKey, v)}
            placeholder={config.placeholder}
          />
        );

      case "textarea":
        return (
          <TextArea
            key={fieldKey}
            label={config.label}
            readOnly={config.readOnly}
            disabled={config.disabled}
            value={String(fieldValue ?? "")}
            onChange={(v) => handleFieldChange(fieldKey, v)}
            placeholder={config.placeholder}
            rows={4}
          />
        );

      case "select":
        return (
          <Select
            key={fieldKey}
            label={config.label}
            disabled={config.disabled || config.readOnly}
            value={String(fieldValue ?? "")}
            onChange={(v) => handleFieldChange(fieldKey, v)}
            options={
              (config.options as { label: string; value: string }[]) || []
            }
            searchable
          />
        );

      case "keyvalue":
        return (
          <KeyValueEditor
            key={fieldKey}
            label={config.label}
            value={(fieldValue as Record<string, string | number>) || {}}
            onChange={(v) => handleFieldChange(fieldKey, v)}
            keySchema={config.keySchema}
            editable={config.editable}
            disabled={config.disabled || config.readOnly}
          />
        );

      case "port":
        if (!node.type) return null;
        return (
          <PortEditor
            key={fieldKey}
            label={config.label}
            value={(fieldValue as NodePort[]) || []}
            nodeType={node.type}
            edges={edges}
            currentNodeId={node.id}
            onChange={(v) => handleFieldChange(fieldKey, v)}
            readOnly={config.disabled || config.readOnly}
          />
        );

      default:
        return null;
    }
  };

  const renderField = (
    key: KeysOfUnion<WorkflowNode["data"]>,
    value: unknown
  ) => {
    // Get field config from fixtures only
    if (!node.type) return null;

    const fieldConfig = getFieldConfig(node.type, key);

    // Skip fields not defined in fixtures or readOnly fields
    if (!fieldConfig) return null;

    const fieldValue = formData[key] ?? value;

    // Handle tab type separately
    if (fieldConfig.type === "tab") {
      const tabOptions = fieldConfig.options as TabOption[];
      const currentTabValue = String(fieldValue ?? "");

      // Find the active tab
      const activeTab = tabOptions.find((tab) => tab.value === currentTabValue);

      return (
        <div key={key} className="space-y-4">
          <Tabs
            label={fieldConfig.label}
            value={currentTabValue}
            onChange={(v) => handleFieldChange(key, v)}
            options={tabOptions.map((tab) => ({
              label: tab.label,
              value: tab.value,
            }))}
            disabled={fieldConfig.disabled}
          />

          {/* Render fields for the active tab */}
          {activeTab?.options?.map((fieldDef) => {
            if (!fieldDef.key) return null;

            // Hide body field when method is GET
            if (fieldDef.key === "body" && formData.method === "GET") {
              return null;
            }

            return renderFieldByConfig(fieldDef, fieldDef.key);
          })}
        </div>
      );
    }

    // For non-tab fields, use renderFieldByConfig
    return renderFieldByConfig(fieldConfig, key);
  };

  return (
    <div className="space-y-4">
      {Object.entries(node.data).map(([key, value]) =>
        renderField(key as KeysOfUnion<WorkflowNode["data"]>, value)
      )}

      <button
        onClick={handleSave}
        className="w-full px-4 py-2 bg-palette-primary-bg hover:bg-palette-primary-color text-white rounded-lg font-medium transition-colors"
      >
        Save Changes
      </button>
    </div>
  );
}
