"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2Icon, FileIcon, Loader2Icon, PaperclipIcon, UploadCloudIcon, XCircleIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatBytes } from "@/lib/documents/storage";
import { uploadFileToEntity, validateFile } from "@/lib/documents/upload-client";
import type { DocumentModule } from "@/lib/types/database";
import { ALLOWED_EXTENSIONS, MAX_FILE_SIZE_BYTES } from "@/lib/validation/documents";

type QueuedFile = {
  id: string;
  file: File;
  status: "queued" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
};

const ACCEPT = ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(",");

/**
 * Drag-and-drop uploader for an existing record.
 * Issues a signed URL, PUTs the file to Storage, then writes metadata.
 */
export function FileUpload({
  module,
  entityId,
  milestoneId,
  onUploaded,
  className,
  compact = false,
}: {
  module: DocumentModule;
  entityId: string;
  /** Project documents only: upload into this milestone's subfolder. */
  milestoneId?: string;
  onUploaded?: () => void;
  className?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [dragging, setDragging] = useState(false);

  const update = (id: string, patch: Partial<QueuedFile>) =>
    setQueue((q) => q.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  const uploadOne = useCallback(
    async (item: QueuedFile) => {
      update(item.id, { status: "uploading", progress: 5 });
      const error = await uploadFileToEntity(module, entityId, item.file, (pct) => update(item.id, { progress: pct }), milestoneId);
      if (error) {
        update(item.id, { status: "error", error });
        return false;
      }
      update(item.id, { status: "done", progress: 100 });
      return true;
    },
    [module, entityId, milestoneId],
  );

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const items: QueuedFile[] = Array.from(files).map((file) => {
        const error = validateFile(file);
        return { id: crypto.randomUUID(), file, status: error ? "error" : "queued", progress: 0, error: error ?? undefined };
      });
      setQueue((q) => [...q, ...items]);

      let success = 0;
      for (const item of items) {
        if (item.status === "error") continue;
        if (await uploadOne(item)) success += 1;
      }
      if (success) {
        toast.success(success === 1 ? "File uploaded." : `${success} files uploaded.`);
        onUploaded?.();
        router.refresh();
      }
    },
    [uploadOne, onUploaded, router],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.length) void addFiles(e.dataTransfer.files);
  };

  const remove = (id: string) => setQueue((q) => q.filter((i) => i.id !== id));
  const clearFinished = () => setQueue((q) => q.filter((i) => i.status !== "done"));

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div
        role="button"
        tabIndex={0}
        aria-label="Attach files"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed text-center transition-colors",
          compact ? "px-4 py-4" : "px-6 py-8",
          dragging ? "border-brand bg-brand/5" : "border-border hover:border-brand/50 hover:bg-muted/40",
        )}
      >
        {compact ? <PaperclipIcon className="size-5 text-brand" /> : <UploadCloudIcon className="size-7 text-brand" />}
        <p className="text-sm font-medium">
          {compact ? "Attach file" : "Drop files here or "}
          {compact ? null : <span className="text-brand underline">browse</span>}
          {compact ? <span className="text-muted-foreground"> — drop or browse</span> : null}
        </p>
        <p className="text-xs text-muted-foreground">
          PDF, Office, images, text · up to {formatBytes(MAX_FILE_SIZE_BYTES)} each
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="sr-only"
          onChange={(e) => {
            if (e.target.files?.length) void addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {queue.length ? (
        <ul className="flex flex-col gap-2">
          {queue.map((item) => (
            <li key={item.id} className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2 text-sm">
              <FileIcon className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{item.file.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(item.file.size)}</span>
                </div>
                {item.status === "uploading" ? <Progress value={item.progress} className="mt-1 h-1.5" /> : null}
                {item.status === "error" ? <p className="text-xs text-destructive">{item.error}</p> : null}
              </div>
              {item.status === "uploading" ? <Loader2Icon className="size-4 animate-spin text-brand" /> : null}
              {item.status === "done" ? <CheckCircle2Icon className="size-4 text-success" /> : null}
              {item.status === "error" ? <XCircleIcon className="size-4 text-destructive" /> : null}
              {item.status !== "uploading" ? (
                <button type="button" onClick={() => remove(item.id)} className="text-muted-foreground hover:text-foreground" aria-label="Remove from list">
                  <XIcon className="size-4" />
                </button>
              ) : null}
            </li>
          ))}
          {queue.some((i) => i.status === "done") ? (
            <li className="text-right">
              <Button type="button" variant="ghost" size="sm" onClick={clearFinished}>
                Clear completed
              </Button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
