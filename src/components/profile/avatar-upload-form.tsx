"use client";

import { useState, useRef, useEffect, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { updateProfileImage } from "@/actions/profile";
import { RemoveAvatarDialog } from "@/components/profile/remove-avatar-dialog";

type Props = {
  currentImage: string | null;
  initials: string;
};

const MAX_BYTES = 5 * 1024 * 1024; // 5MB

export function AvatarUploadForm({ currentImage, initials }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function pick() {
    if (submitting) return;
    inputRef.current?.click();
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    e.target.value = ""; // para mapili ulit ang parehong file
    if (!selected) return;

    if (!selected.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    if (selected.size > MAX_BYTES) {
      toast.error("Image is too large. Maximum size is 5MB.");
      return;
    }

    if (preview) URL.revokeObjectURL(preview);
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  }

  function cancel() {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
  }

  async function save() {
    if (!file) return;
    setSubmitting(true);

    const formData = new FormData();
    formData.append("file", file);

    const result = await updateProfileImage(formData);
    setSubmitting(false);

    if (result?.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Profile photo updated");
    cancel();
    router.refresh();
  }

  const shown = preview ?? currentImage ?? undefined;

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={pick}
        disabled={submitting}
        className="group relative rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 disabled:cursor-not-allowed"
        aria-label="Change profile photo"
        title="Click to change photo"
      >
        <Avatar className="w-16 h-16">
          {shown && <AvatarImage src={shown} alt="Profile photo" />}
          <AvatarFallback className="bg-green-100 text-green-700 text-xl font-medium">
            {initials}
          </AvatarFallback>
        </Avatar>
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 rounded-full bg-black/45 text-white opacity-0 transition group-hover:opacity-100">
          <Camera className="w-4 h-4" />
          <span className="text-[9px] font-medium">Change</span>
        </span>
      </button>

      {file && (
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            onClick={save}
            disabled={submitting}
            className="h-7 px-2 text-xs"
          >
            {submitting ? "Saving..." : "Save"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={cancel}
            disabled={submitting}
            className="h-7 px-2 text-xs"
          >
            Cancel
          </Button>
        </div>
      )}

      {!file && currentImage && (
        <RemoveAvatarDialog
          trigger={
            <button
              type="button"
              disabled={submitting}
              className="text-xs text-muted-foreground hover:text-red-600 disabled:cursor-not-allowed"
            >
              Remove photo
            </button>
          }
        />
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={onFileChange}
        className="hidden"
      />
    </div>
  );
}