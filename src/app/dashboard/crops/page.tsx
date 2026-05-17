import Link from "next/link";
import { Plus } from "lucide-react";
import { Prisma } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { CropsTable } from "@/components/crops/crops-table";

const PAGE_SIZE = 20;

type SearchParams = {
  q?: string;
  sort?: string;
  page?: string;
};

export default async function CropsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();

  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const sort = params.sort ?? "name-asc";
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  // 🔍 Search: crop name or variety (case-insensitive)
  const where: Prisma.CropWhereInput = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { variety: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

  // 🎛️ Sort
  let orderBy: Prisma.CropOrderByWithRelationInput;
  switch (sort) {
    case "name-desc":
      orderBy = { name: "desc" };
      break;
    case "days-asc":
      orderBy = { daysToHarvest: "asc" };
      break;
    case "days-desc":
      orderBy = { daysToHarvest: "desc" };
      break;
    case "recent":
      orderBy = { createdAt: "desc" };
      break;
    case "name-asc":
    default:
      orderBy = { name: "asc" };
      break;
  }

  const [crops, total] = await Promise.all([
    prisma.crop.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        variety: true,
        daysToHarvest: true,
        _count: { select: { stages: true, plots: true } },
      },
    }),
    prisma.crop.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Crops</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage crop profiles and ideal thresholds for each growth stage.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/crops/new">
            <Plus className="w-4 h-4 mr-2" />
            Add crop
          </Link>
        </Button>
      </div>

      <CropsTable
        crops={crops}
        total={total}
        page={page}
        totalPages={totalPages}
        pageSize={PAGE_SIZE}
        query={q}
        sort={sort}
      />
    </div>
  );
}