"use client";

import Link from "next/link";
import { MoreHorizontal, Pencil, Trash2, Sprout } from "lucide-react";
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
import { DeleteCropDialog } from "./delete-crop-dialog";

type CropRow = {
  id: string;
  name: string;
  variety: string | null;
  daysToHarvest: number;
  _count: { stages: number; plots: number };
};

export function CropsTable({ crops }: { crops: CropRow[] }) {
  if (crops.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-gray-500 border border-dashed rounded-md">
        <Sprout className="w-8 h-8 mx-auto text-gray-300 mb-2" />
        No crops yet. Click &quot;Add crop&quot; to create one.
      </div>
    );
  }

  return (
    <div className="border rounded-md bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Crop</TableHead>
            <TableHead>Variety</TableHead>
            <TableHead>Days to harvest</TableHead>
            <TableHead>Stages</TableHead>
            <TableHead>In use</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {crops.map((crop) => (
            <TableRow key={crop.id}>
              <TableCell className="font-medium">
                <Link
                  href={`/dashboard/crops/${crop.id}/edit`}
                  className="hover:underline"
                >
                  {crop.name}
                </Link>
              </TableCell>
              <TableCell className="text-gray-600">
                {crop.variety ?? "—"}
              </TableCell>
              <TableCell className="text-gray-600">
                {crop.daysToHarvest} days
              </TableCell>
              <TableCell>
                <Badge variant="secondary">{crop._count.stages} stages</Badge>
              </TableCell>
              <TableCell className="text-gray-600">
                {crop._count.plots > 0
                  ? `${crop._count.plots} plot(s)`
                  : "Not planted"}
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
                      <Link href={`/dashboard/crops/${crop.id}/edit`}>
                        <Pencil className="w-4 h-4 mr-2" />
                        Edit
                      </Link>
                    </DropdownMenuItem>
                    <DeleteCropDialog
                      cropId={crop.id}
                      cropName={crop.name}
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