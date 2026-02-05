import { useState } from "react";
import { Trash2 } from "lucide-react";

import Input from "@/components/Input";
import TextArea from "@/components/TextArea";
import Select from "@/components/Select";
import KeyValueEditor from "@/components/PropertiesPanel/KeyValueEditor";
import Tabs from "@/components/Tabs";
import PortEditor from "@/components/PortEditor";

import {
  getFieldConfig,
  getValueByNestedPath,
  updateStateByNestedPath,
} from "@/utils/formFieldInference";
import {
  generatePanelCode,
  supportsPanelCodeGeneration,
} from "@/utils/workflow";

import type { WorkflowNode, NodePort } from "@/types/nodes";
import type { WorkflowEdge } from "@/types/edges";
import type { FieldConfig, TabOption } from "@/types/editor";
import type { DeepKeysOfUnion } from "@/types/utils";
import PropertiesPanelDialog from "./Dialog";

interface DynamicNodeEditorProps {
  node: WorkflowNode;
  edges: WorkflowEdge[];
  onSave: (data: Partial<WorkflowNode["data"]>) => void;
  onDelete: (nodeId: string) => void;
}

export default function DynamicNodeEditor({
  node,
  edges,
  onSave,
  onDelete,
}: DynamicNodeEditorProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [formData, setFormData] = useState<Record<string, any>>(node.data);

  const handleFieldChange = (key: string, value: unknown) => {
    setFormData((prev) => updateStateByNestedPath(prev, key, value));
  };

  const handleSave = () => {
    // Unified panel code generation for all supported node types
    if (
      formData.mode === "panel" &&
      node.type &&
      supportsPanelCodeGeneration(node.type)
    ) {
      const functionCode = generatePanelCode(node.type, formData);

      if (functionCode) {
        // Save with generated code
        onSave({
          ...formData,
          execution: {
            ...node.data.execution,
            config: {
              ...node.data.execution?.config,
              functionCode,
              lastModified: Date.now(),
            },
          },
        } as Partial<WorkflowNode["data"]>);
        return;
      }
    }

    // Normal save for other cases (Code Mode or unsupported node types)
    onSave(formData as Partial<WorkflowNode["data"]>);
  };

  const renderFieldByConfig = (config: FieldConfig, fieldKey: string) => {
    const fieldValue =
      getValueByNestedPath(formData, fieldKey) ??
      getValueByNestedPath(node.data, fieldKey);

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

  const handleDialog = async () => {
    const confirm = await dialog.confirm(
      "Confirm Node Deletion",
      <PropertiesPanelDialog />,
    );

    if (confirm) {
      onDelete(node.id);
    }
  };
  const renderField = (
    key: DeepKeysOfUnion<WorkflowNode["data"]>,
    value: unknown,
  ) => {
    // Get field config from fixtures only
    if (!node.type) return null;

    const fieldConfig = getFieldConfig(node.type, key);

    // Skip fields not defined in fixtures or readOnly fields
    const config = fieldConfig?.config;
    if (!config) return null;

    const fieldValue = formData[key] ?? value;

    // Handle tab type separately
    if (config.type === "tab") {
      const tabOptions = config.options as TabOption[];
      const currentTabValue = String(fieldValue ?? "");

      // Find the active tab
      const activeTab = tabOptions.find((tab) => tab.value === currentTabValue);

      return (
        <div key={key} className="space-y-4">
          <Tabs
            label={config.label}
            value={currentTabValue}
            onChange={(v) => handleFieldChange(key, v)}
            options={tabOptions.map((tab) => ({
              label: tab.label,
              value: tab.value,
            }))}
            disabled={config.disabled}
          />

          {/* Render fields for the active tab */}
          {activeTab?.options?.map((fieldDef) => {
            if (!fieldDef.key) return null;

            // Hide body field when method is GET
            if (
              fieldDef.key === "http.body" &&
              formData.http?.method === "GET"
            ) {
              return null;
            }

            return renderFieldByConfig(fieldDef, fieldDef.key);
          })}
        </div>
      );
    }

    // For non-tab fields, use renderFieldByConfig

    return renderFieldByConfig(config, fieldConfig.key);
  };

  return (
    <div className="space-y-4">
      {Object.entries(node.data).map(([key, value]) =>
        renderField(key as DeepKeysOfUnion<WorkflowNode["data"]>, value),
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          className="flex-1 px-4 py-2 bg-palette-primary-bg hover:bg-palette-primary-color text-white rounded-lg font-medium transition-colors"
        >
          Save Changes
        </button>
        <button
          onClick={handleDialog}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          title="Delete Node"
        >
          <Trash2 className="w-4 h-4" />
          Delete
        </button>
      </div>
    </div>
  );
}
