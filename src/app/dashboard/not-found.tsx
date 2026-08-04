import { FileQuestion } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export default function DashboardNotFound() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <EmptyState
        icon={FileQuestion}
        title="We couldn't find that page or record."
        description="It may have been moved, deleted, or the link might be out of date."
        action={{ label: "Back to Dashboard", href: "/dashboard" }}
      />
    </div>
  );
}
