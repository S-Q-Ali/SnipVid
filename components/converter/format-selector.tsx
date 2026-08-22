import { Select, SelectItem, SelectTrigger, SelectValue } from "radix-react";

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
      <Select
        value={value}
        onValueChange={onSelect}
        className="w-full"
      >
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>

        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <span className="flex items-start gap-2">
                <span className="flex-shrink-0">
                  {option.label}
                </span>
                {option.description && (
                  <span className="ml-auto text-xs text-muted-foreground capitalize">
                    {option.description}
                  </span>
                )}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}