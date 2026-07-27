"use client";

import { AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex items-center justify-center py-16 px-6 page-fade-in">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-red-100 mb-4">
          <AlertCircle className="w-7 h-7 text-red-600" />
        </div>
        <h1 className="text-xl font-semibold text-foreground mb-2">
          Couldn&apos;t load this page
        </h1>
        <p className="text-muted-foreground text-sm mb-6">
          An unexpected error occurred while loading this section.
        </p>
        <Button onClick={reset} className="bg-green-600 hover:bg-green-700">
          <RotateCcw className="w-4 h-4 mr-2" />
          Try again
        </Button>
      </div>
    </div>
  );
}
