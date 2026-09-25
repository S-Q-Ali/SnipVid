import * as React from "react";

export interface FormatOption {
  value: string;
  label: string;
  description?: string;
}

export interface FormatSelectorProps {
  value: string;
  onSelect: (value: string) => void;
  options: FormatOption[];
  placeholder?: string;
}

export function FormatSelector({
  value,
  onSelect,
  options,
  placeholder = "Select format",
}: FormatSelectorProps) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onSelect(e.target.value)}
        className="input-field w-full appearance-none pr-8"
        aria-label={placeholder}
      >
        {!value && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
            {option.description ? ` - ${option.description}` : ""}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
          clipRule="evenodd"
        />
      </svg>
    </div>
  );
}