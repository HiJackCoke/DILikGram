/**
 * API Key Setup Component
 *
 * Allows users to input, save, and manage their OpenAI API key
 */

import { useState } from "react";
import { Eye, EyeOff, Key } from "lucide-react";

interface ApiKeySetupProps {
  value: string;
  onChange: (value: string) => void;
  // onSave?: (key: string) => void;
  // onRemove?: () => void;
  // hasSavedKey: boolean;
}

export default function ApiKeySetup({
  value,
  onChange,
  // onSave,
  // onRemove,
  // hasSavedKey,
}: ApiKeySetupProps) {
  const [showKey, setShowKey] = useState(false);

  // const handleSave = () => {
  //   if (value.trim() && onSave) {
  //     onSave(value.trim());
  //   }
  // };

  // const handleRemove = () => {
  //   onChange("");
  //   onRemove?.();
  // };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Key className="w-4 h-4 text-palette-primary-color" />
        <label className="text-sm font-medium text-gray-700">
          OpenAI API Key
        </label>
        {/* {hasSavedKey && (
          <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">
            Saved
          </span>
        )} */}
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={showKey ? "text" : "password"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="sk-..."
            className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-palette-primary-color focus:border-transparent text-sm font-mono"
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label={showKey ? "Hide API key" : "Show API key"}
          >
            {showKey ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* {!hasSavedKey && value.trim() && (
          <Button
            palette="primary"
            size="md"
            onClick={handleSave}
            className="shrink-0"
          >
            Save
          </Button>
        )} */}

        {/* {hasSavedKey && (
          <Button
            palette="danger"
            variant="outline"
            size="md"
            icon={<Trash2 className="w-4 h-4" />}
            iconOnly
            onClick={handleRemove}
            aria-label="Remove saved API key"
          />
        )} */}
      </div>

      <p className="text-xs text-gray-500">
        Your API key is stored locally in your browser and never sent to our
        servers. Get your API key from{" "}
        <a
          href="https://platform.openai.com/api-keys"
          target="_blank"
          rel="noopener noreferrer"
          className="text-palette-primary-color hover:underline"
        >
          OpenAI Platform
        </a>
        .
      </p>
    </div>
  );
}
