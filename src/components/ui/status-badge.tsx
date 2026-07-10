import { cn } from "@/lib/utils";

export type StatusVariant = "success" | "warning" | "danger" | "info" | "neutral";

const variantClasses: Record<StatusVariant, string> = {
  success: "bg-success-bg text-success-text border-success-border",
  warning: "bg-warning-bg text-warning-text border-warning-border",
  danger: "bg-danger-bg text-danger-text border-danger-border",
  info: "bg-info-bg text-info-text border-info-border",
  neutral: "bg-muted text-muted-foreground border-border",
};

export function StatusBadge({
  variant,
  className,
  children,
}: {
  variant: StatusVariant;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap",
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
