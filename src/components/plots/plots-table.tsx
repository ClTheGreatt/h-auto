"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Trash2, MapPinned } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusBadge, type StatusVariant } from "@/components/ui/status-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { DeletePlotDialog } from "./delete-plot-dialog";
import type { PlotStatus } from "@prisma/client";

type PlotRow = {
  id: string;
  name: string;
  location: string | null;
  status: PlotStatus;
  crop: { name: string } | null;
  currentStage: { name: string } | null;
  _count: { assignments: number };
};

const statusLabels: Record<PlotStatus, string> = {
  PREPARING: "Preparing",
  PLANTED: "Planted",
  GROWING: "Growing",
  READY_FOR_HARVEST: "Ready for harvest",
  HARVESTED: "Harvested",
  FALLOW: "Fallow",
  ARCHIVED: "Archived",
};

const statusVariant: Record<PlotStatus, StatusVariant> = {
  PREPARING: "neutral",
  PLANTED: "info",
  GROWING: "success",
  READY_FOR_HARVEST: "warning",
  HARVESTED: "success",
  FALLOW: "neutral",
  ARCHIVED: "neutral",
};

export function PlotsTable({
  plots,
  canManage,
}: {
  plots: PlotRow[];
  canManage: boolean;
}) {
  const router = useRouter();

  if (plots.length === 0) {
    return (
      <EmptyState
        icon={MapPinned}
        title="No plots found"
        description="Try adjusting your search or filters, or add a new plot to get started."
        action={
          canManage
            ? {
                label: "Add plot",
                href: "/dashboard/plots/new",
              }
            : undefined
        }
      />
    );
  }

  return (
    <Card className="overflow-x-auto p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Plot</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Crop</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Students</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {plots.map((plot) => (
            <TableRow
              key={plot.id}
              onClick={() => router.push(`/dashboard/plots/${plot.id}`)}
              className="cursor-pointer hover:bg-muted/50"
            >
              <TableCell className="font-medium whitespace-nowrap">
                <Link
                  href={`/dashboard/plots/${plot.id}`}
                  className="hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {plot.name}
                </Link>
              </TableCell>
              <TableCell className="text-gray-600">
                {plot.location ?? "—"}
              </TableCell>
              <TableCell className="text-gray-600">
                {plot.crop?.name ?? "—"}
              </TableCell>
              <TableCell className="text-gray-600">
                {plot.currentStage?.name ?? "—"}
              </TableCell>
              <TableCell>
                <StatusBadge variant={statusVariant[plot.status]}>
                  {statusLabels[plot.status]}
                </StatusBadge>
              </TableCell>
              <TableCell className="text-gray-600">
                {plot._count.assignments > 0
                  ? `${plot._count.assignments} assigned`
                  : "None"}
              </TableCell>
              <TableCell>
                {canManage && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DropdownMenuItem asChild>
                        <Link href={`/dashboard/plots/${plot.id}/edit`}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Edit
                        </Link>
                      </DropdownMenuItem>
                      <DeletePlotDialog
                        plotId={plot.id}
                        plotName={plot.name}
                        trigger={
                          <DropdownMenuItem
                            onSelect={(e) => e.preventDefault()}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Archive
                          </DropdownMenuItem>
                        }
                      />
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}