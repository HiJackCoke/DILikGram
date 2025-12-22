/**
 * Prompt Input Component
 *
 * Textarea for workflow description with example prompts
 */

import { MessageSquare } from "lucide-react";

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const EXAMPLE_PROMPTS = [
  "Create a user registration workflow with email verification",
  "Build an order processing workflow with payment and inventory check",
  "Make a data validation workflow with format checking",
  "Design a customer support ticket workflow with routing",
];

export default function PromptInput({
  value,
  onChange,
  disabled,
}: PromptInputProps) {
  const handleExampleClick = (example: string) => {
    onChange(example);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-palette-primary-color" />
        <label className="text-sm font-medium text-gray-700">
          Describe Your Workflow
        </label>
      </div>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="Describe the workflow you want to create..."
        rows={4}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-palette-primary-color focus:border-transparent resize-none text-sm disabled:bg-gray-50 disabled:cursor-not-allowed"
      />

      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-600">Try these examples:</p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_PROMPTS.map((example, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleExampleClick(example)}
              disabled={disabled}
              className="px-2 py-1 text-xs text-white bg-palette-primary-bg border border-palette-primary-border rounded hover:bg-palette-primary-border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {example}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
