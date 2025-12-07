import { useState, useEffect, useMemo } from "react";
import type { WorkflowNode } from "@/types/nodes";
import { getFieldConfig } from "@/utils/formFieldInference";
import Input from "@/components/Input";
import TextArea from "@/components/TextArea";
import Select from "@/components/Select";
import KeyValueEditor from "@/components/KeyValueEditor";

interface DynamicNodeEditorProps {
  node: WorkflowNode;
  onSave: (data: Partial<WorkflowNode["data"]>) => void;
}

export default function DynamicNodeEditor({
  node,
  onSave,
}: DynamicNodeEditorProps) {
  const [formData, setFormData] = useState<Record<string, unknown>>({});

  // Compute initial data from node.data using useMemo
  const initialData = useMemo(() => {
    const data: Record<string, unknown> = {};
    Object.entries(node.data).forEach(([key, value]) => {
      // Exclude readonly fields
      if (!node.type) return;
      const fieldConfig = getFieldConfig(node.type, key);
      if (fieldConfig && !fieldConfig.readonly) {
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
    onSave(formData as Partial<WorkflowNode["data"]>);
  };

  const renderField = (key: string, value: unknown) => {
    // Get field config from fixtures only
    if (!node.type) return null;

    const fieldConfig = getFieldConfig(node.type, key);

    // Skip fields not defined in fixtures or readonly fields
    if (!fieldConfig || fieldConfig.readonly) return null;

    const fieldValue = formData[key] ?? value;

    switch (fieldConfig.type) {
      case "text":
        return (
          <Input
            key={key}
            label={fieldConfig.label}
            value={String(fieldValue ?? "")}
            onChange={(v) => handleFieldChange(key, v)}
            placeholder={fieldConfig.placeholder}
          />
        );

      case "number":
        return (
          <Input
            key={key}
            type={fieldConfig.type}
            formatNumber={fieldConfig.type === "number"}
            label={fieldConfig.label}
            value={Number(fieldValue ?? 0)}
            onChange={(v) => handleFieldChange(key, v)}
            placeholder={fieldConfig.placeholder}
          />
        );

      case "textarea":
        return (
          <TextArea
            key={key}
            label={fieldConfig.label}
            value={String(fieldValue ?? "")}
            onChange={(v) => handleFieldChange(key, v)}
            placeholder={fieldConfig.placeholder}
            rows={4}
          />
        );

      case "select":
        return (
          <Select
            key={key}
            label={fieldConfig.label}
            value={String(fieldValue ?? "")}
            onChange={(v) => handleFieldChange(key, v)}
            options={fieldConfig.options || []}
            searchable
          />
        );

      case "keyvalue":
        return (
          <KeyValueEditor
            key={key}
            label={fieldConfig.label}
            value={(fieldValue as Record<string, string>) || {}}
            onChange={(v) => handleFieldChange(key, v)}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {Object.entries(node.data).map(([key, value]) => renderField(key, value))}

      <button
        onClick={handleSave}
        className="w-full px-4 py-2 bg-palette-primary-bg hover:bg-palette-primary-color text-white rounded-lg font-medium transition-colors"
      >
        Save Changes
      </button>
    </div>
  );
}
