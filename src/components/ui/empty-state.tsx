import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

type EmptyStateAction = { label: string; href: string };

function isLinkAction(action: unknown): action is EmptyStateAction {
  return (
    !!action &&
    typeof action === "object" &&
    "label" in action &&
    "href" in action
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Either the original { label, href } shape (renders a Button+Link), or any custom node. */
  action?: EmptyStateAction | React.ReactNode;
  /** Smaller padding/icon, no border/background — for embedding inside an existing Card. */
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact
          ? "text-center py-8"
          : "text-center py-16 px-6 border border-dashed border-gray-300 rounded-lg bg-white"
      }
    >
      <div
        className={
          compact
            ? "inline-flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 mb-2"
            : "inline-flex items-center justify-center w-14 h-14 rounded-full bg-gray-100 mb-4"
        }
      >
        <Icon className={compact ? "w-5 h-5 text-gray-400" : "w-6 h-6 text-gray-400"} />
      </div>
      <h3 className="text-sm font-medium text-gray-900">{title}</h3>
      {description && (
        <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
          {description}
        </p>
      )}
      {action &&
        (isLinkAction(action) ? (
          <Button asChild className="mt-4">
            <Link href={action.href}>{action.label}</Link>
          </Button>
        ) : (
          <div className="mt-4">{action}</div>
        ))}
    </div>
  );
}
