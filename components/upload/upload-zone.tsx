import { FolderUp, X } from "lucide-react";
import * as React from "react";

export interface UploadZoneProps {
  acceptedFiles?: string;
  onFilesSelected?: (files: FileList) => void;
  onRemove?: () => void;
  multiple?: boolean;
  className?: string;
}

export function UploadZone({
  acceptedFiles = "video/*",
  onFilesSelected,
  onRemove,
  multiple = true,
  className,
}: UploadZoneProps) {
  const [files, setFiles] = React.useState<FileList | null>(null);
  const inputId = React.useMemo(() => `upload-input-${Date.now()}`, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles) {
      setFiles(selectedFiles);
      if (onFilesSelected) {
        onFilesSelected(selectedFiles);
      }
    }
  };

  const handleClear = () => {
    setFiles(null);
    if (onRemove) {
      onRemove();
    }
  };

  return (
    <div
      className={`border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer transition-all duration-300 hover:border-primary/50 ${className || ""}`}
      onClick={() => document.getElementById(inputId)?.click()}
    >
      <input
        id={inputId}
        type="file"
        style={{ display: "none" }}
        accept={acceptedFiles}
        multiple={multiple}
        onChange={handleChange}
        aria-label="Upload file"
      />
      <div className="relative z-10">
        <FolderUp className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
        <p className="text-sm text-muted-foreground mb-2 font-medium">
          Click or drag files here
        </p>
        <p className="text-xs text-muted-foreground">
          Supported formats: MP4, MKV, MOV, AVI, WebM, MPEG-4
        </p>
        {files && files.length > 0 && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {Array.from(files).slice(0, 5).map((file, index) => (
              <div
                key={index}
                className="px-3 py-1 rounded text-xs bg-muted/30 text-muted-foreground flex items-center gap-1"
              >
                <span className="max-w-[120px] truncate">{file.name}</span>
                <span className="text-caption opacity-70">
                  ({(file.size / 1024 / 1024).toFixed(1)} MB)
                </span>
              </div>
            ))}
            {files.length > 5 && (
              <span className="px-3 py-1 rounded text-xs bg-muted/30 text-muted-foreground">
                +{files.length - 5} more
              </span>
            )}
          </div>
        )}
        {files && files.length > 0 && onRemove && (
          <button
            type="button"
            className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80"
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            aria-label="Remove all files"
          >
            <X className="h-4 w-4" />
            Clear
          </button>
        )}
      </div>
    </div>
  );
}