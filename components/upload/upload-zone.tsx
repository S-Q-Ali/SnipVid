import { FolderUpload, RefreshCcw, Loader2, X } from "lucide-react";
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && onFilesSelected) {
      onFilesSelected(selectedFiles);
    }
  };

  return (
    <div className={`border-2 border-border rounded-xl p-8 text-center cursor-pointer transition-all duration-300 ${className || ""}`} onClick={() => document.getElementById("upload-input-${Date.now()})?.click()">
      <input
        id={`upload-input-${Date.now()}`
        type="file"
        style={{ display: "none" }}
        accept={acceptedFiles}
        multiple={multiple}
        onChange={handleChange}
      />
      <div className="relative z-10">
        <FolderUpload
          className={["h-12 w-12 mx-auto mb-3", "text-muted-foreground"].join(" ")}
        />
        <p className="text-sm text-muted-foreground mb-2">
          Click or drag files here
        </p>
        <p className="text-xs text-muted-foreground">
          Supported formats: MP4, MKV, MOV, AVI, WebM, MPEG-4
        </p>
        {files && files.length > 0 && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {[...files].slice(0, 3).map((file, index) => (
              <div
                key={index}
                className={`px-3 py-1 rounded text-xs ${files.length > 3 ? "line-clamp-2" : ""} bg-muted/30 text-muted-foreground`}
              >
                {file.name.split(".").slice(0, -1).join(".")}
                {files.length > 3 && (
                  <span className="text-caption">
                    +{files.length - 3} more
                  </span>
                )}
              </div>
            ))}
            {files.length > 3 && (
              <X className="h-4 w-4 text-error" aria-label="Remove all files" />
            )}
          </div>
        )}
        {onRemove && (
          <button
            type="button"
            className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80"
            onClick={onRemove}
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