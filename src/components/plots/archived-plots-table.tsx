"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal, RotateCcw, Eye, Archive } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { RestorePlotDialog } from "./restore-plot-dialog";
import { timeAgo } from "@/lib/format-date";

type ArchivedPlotRow = {
  id: string;
  name: string;
  location: string | null;
  archivedAt: Date | null;
  crop: { name: string } | null;
  _count: { growthLogs: number; sensorReadings: number };
};

export function ArchivedPlotsTable({ plots }: { plots: ArchivedPlotRow[] }) {
  const router = useRouter();

  if (plots.length === 0) {
    return <EmptyState icon={Archive} title="No archived plots" />;
  }

  return (
    <Card className="overflow-x-auto p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Plot</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Crop</TableHead>
            <TableHead>Archived</TableHead>
            <TableHead>Growth logs</TableHead>
            <TableHead>Sensor readings</TableHead>
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
              <TableCell className="text-gray-600 whitespace-nowrap">
                {plot.archivedAt ? timeAgo(plot.archivedAt) : "—"}
              </TableCell>
              <TableCell className="text-gray-600">
                {plot._count.growthLogs}
              </TableCell>
              <TableCell className="text-gray-600">
                {plot._count.sensorReadings}
              </TableCell>
              <TableCell>
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
                      <Link href={`/dashboard/plots/${plot.id}`}>
                        <Eye className="w-4 h-4 mr-2" />
                        View details
                      </Link>
                    </DropdownMenuItem>
                    <RestorePlotDialog
                      plotId={plot.id}
                      plotName={plot.name}
                      trigger={
                        <DropdownMenuItem
                          onSelect={(e) => e.preventDefault()}
                          className="text-green-700 focus:text-green-700"
                        >
                          <RotateCcw className="w-4 h-4 mr-2" />
                          Restore
                        </DropdownMenuItem>
                      }
                    />
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
