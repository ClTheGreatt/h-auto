"use client";

import { useState, useRef, useEffect, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { updateProfileImage } from "@/actions/profile";

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
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Profile photo</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={pick}
            disabled={submitting}
            className="group relative rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 disabled:cursor-not-allowed"
            aria-label="Change profile photo"
          >
            <Avatar className="w-20 h-20">
              {shown && <AvatarImage src={shown} alt="Profile photo" />}
              <AvatarFallback className="bg-green-100 text-green-700 text-xl font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 rounded-full bg-black/45 text-white opacity-0 transition group-hover:opacity-100">
              <Camera className="w-5 h-5" />
              <span className="text-[10px] font-medium">Change</span>
            </span>
          </button>

          <div className="flex flex-col gap-2">
            {file ? (
              <div className="flex items-center gap-2">
                <Button type="button" onClick={save} disabled={submitting}>
                  {submitting ? "Saving..." : "Save photo"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={cancel}
                  disabled={submitting}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <p className="text-sm text-gray-600">
                Click your photo to upload a new one.
              </p>
            )}
            <p className="text-xs text-gray-500">JPG, PNG, or WebP. Maximum 5MB.</p>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={onFileChange}
            className="hidden"
          />
        </div>
      </CardContent>
    </Card>
  );
}