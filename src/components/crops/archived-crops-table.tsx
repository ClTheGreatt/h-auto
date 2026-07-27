"use client";

import { MoreHorizontal, RotateCcw, Archive } from "lucide-react";
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
import { RestoreCropDialog } from "./restore-crop-dialog";
import { timeAgo, formatDate } from "@/lib/format-date";

type ArchivedCropRow = {
  id: string;
  name: string;
  variety: string | null;
  daysToHarvest: number;
  archivedAt: Date | null;
  _count: { plots: number };
};

export function ArchivedCropsTable({ crops }: { crops: ArchivedCropRow[] }) {
  if (crops.length === 0) {
    return <EmptyState icon={Archive} title="No archived crops" />;
  }

  return (
    <Card className="overflow-x-auto p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Crop</TableHead>
            <TableHead>Variety</TableHead>
            <TableHead>Days to harvest</TableHead>
            <TableHead>Archived</TableHead>
            <TableHead>Plots using this crop</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {crops.map((crop) => (
            <TableRow key={crop.id}>
              <TableCell className="font-medium whitespace-nowrap">
                {crop.name}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {crop.variety ?? "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {crop.daysToHarvest} days
              </TableCell>
              <TableCell className="text-muted-foreground whitespace-nowrap">
                {crop.archivedAt
                  ? `${timeAgo(crop.archivedAt)} (${formatDate(crop.archivedAt)})`
                  : "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {crop._count.plots > 0
                  ? `${crop._count.plots} plot${crop._count.plots === 1 ? "" : "s"}`
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
                    <RestoreCropDialog
                      cropId={crop.id}
                      cropName={crop.name}
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
