"use client";

import Link from "next/link";
import { MoreHorizontal, Eye, Pencil, Trash2, MapPinned } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
};

const statusColors: Record<PlotStatus, string> = {
  PREPARING: "bg-gray-100 text-gray-700 hover:bg-gray-100",
  PLANTED: "bg-blue-100 text-blue-700 hover:bg-blue-100",
  GROWING: "bg-green-100 text-green-700 hover:bg-green-100",
  READY_FOR_HARVEST: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  HARVESTED: "bg-purple-100 text-purple-700 hover:bg-purple-100",
  FALLOW: "bg-stone-100 text-stone-700 hover:bg-stone-100",
};

export function PlotsTable({
  plots,
  canManage,
}: {
  plots: PlotRow[];
  canManage: boolean;
}) {
  if (plots.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-gray-500 border border-dashed rounded-md">
        <MapPinned className="w-8 h-8 mx-auto text-gray-300 mb-2" />
        No plots yet.
      </div>
    );
  }

  return (
    <div className="border rounded-md bg-white">
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
            <TableRow key={plot.id}>
              <TableCell className="font-medium">
                <Link
                  href={`/dashboard/plots/${plot.id}`}
                  className="hover:underline"
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
                <Badge variant="secondary" className={statusColors[plot.status]}>
                  {statusLabels[plot.status]}
                </Badge>
              </TableCell>
              <TableCell className="text-gray-600">
                {plot._count.assignments > 0
                  ? `${plot._count.assignments} assigned`
                  : "None"}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/dashboard/plots/${plot.id}`}>
                        <Eye className="w-4 h-4 mr-2" />
                        View
                      </Link>
                    </DropdownMenuItem>
                    {canManage && (
                      <>
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
                              Delete
                            </DropdownMenuItem>
                          }
                        />
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}