"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export function BackButton({ label }: { label: string }) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="text-sm text-muted-foreground hover:text-gray-700 flex items-center gap-1 mb-4 cursor-pointer"
    >
      <ArrowLeft className="w-4 h-4" />
      {label}
    </button>
  );
}