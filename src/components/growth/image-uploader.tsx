"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
import { Upload, X, ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type ImageUploaderProps = {
  value: string[];
  onChange: (urls: string[]) => void;
  maxImages?: number;
  disabled?: boolean;
};

export function ImageUploader({
  value,
  onChange,
  maxImages = 5,
  disabled = false,
}: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const remainingSlots = maxImages - value.length;
  const canAddMore = remainingSlots > 0 && !disabled;

  async function uploadFile(file: File): Promise<string | null> {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Upload failed");
        return null;
      }

      return data.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
      return null;
    }
  }

  async function handleFiles(files: FileList | File[]) {
    if (!canAddMore) return;

    const fileArray = Array.from(files);
    const toUpload = fileArray.slice(0, remainingSlots);

    if (fileArray.length > remainingSlots) {
      toast.warning(
        `Only the first ${remainingSlots} file(s) will be uploaded (limit ${maxImages})`
      );
    }

    setUploading(true);
    const uploadedUrls: string[] = [];

    for (const file of toUpload) {
      const url = await uploadFile(file);
      if (url) uploadedUrls.push(url);
    }

    setUploading(false);

    if (uploadedUrls.length > 0) {
      onChange([...value, ...uploadedUrls]);
      toast.success(`Uploaded ${uploadedUrls.length} image(s)`);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }

  function removeImage(index: number) {
    const updated = value.filter((_, i) => i !== index);
    onChange(updated);
  }

  return (
    <div className="space-y-3">
      {/* Previews */}
      {value.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {value.map((url, i) => (
            <div
              key={url + i}
              className="relative aspect-square border rounded-md overflow-hidden bg-muted group"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Image ${i + 1}`}
                className="w-full h-full object-cover"
              />
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                  aria-label="Remove image"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload area */}
      {canAddMore && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={
            "border-2 border-dashed rounded-md p-6 text-center transition " +
            (dragOver ? "border-green-500 bg-green-50" : "border-border")
          }
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            className="hidden"
            disabled={uploading}
          />

          {uploading ? (
            <div className="flex flex-col items-center gap-2 py-2">
              <Loader2 className="w-6 h-6 text-green-600 animate-spin" />
              <p className="text-sm text-muted-foreground">Uploading...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <ImageIcon className="w-5 h-5 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-700">
                Drag and drop or click to upload
              </p>
              <p className="text-xs text-muted-foreground">
                JPEG, PNG, WebP, GIF up to 5MB • {remainingSlots} slot
                {remainingSlots !== 1 ? "s" : ""} remaining
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="mt-2"
              >
                <Upload className="w-4 h-4 mr-2" />
                Choose files
              </Button>
            </div>
          )}
        </div>
      )}

      {!canAddMore && value.length >= maxImages && (
        <p className="text-xs text-muted-foreground text-center">
          Maximum {maxImages} images reached. Remove one to add more.
        </p>
      )}
    </div>
  );
}