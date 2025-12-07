interface SegmentOption {
  label: string;
  value: string;
}

interface SegmentTabsProps {
  label: string;
  value: string;
  options: SegmentOption[];
  disabled?: boolean;
  onChange: (value: string) => void;
}

export default function Tabs({
  label,
  value,
  options,
  disabled = false,
  onChange,
}: SegmentTabsProps) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-200">
        {label}
      </label>
      <div className="inline-flex rounded-lg bg-slate-700 p-1">
        {options.map((option) => {
          const isActive = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => !disabled && onChange(option.value)}
              disabled={disabled}
              className={`
                px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200
                ${
                  isActive
                    ? "bg-palette-primary-bg text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }
                ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
              `}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
