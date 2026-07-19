import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sp = request.nextUrl.searchParams;
  const firstName = sp.get("firstName")?.trim();
  const lastName = sp.get("lastName")?.trim();
  const excludeId = sp.get("excludeId") ?? undefined;

  if (!firstName || !lastName) {
    return NextResponse.json({ similarUsers: [] });
  }

  const similarUsers = await prisma.user.findMany({
    where: {
      firstName: { equals: firstName, mode: "insensitive" },
      lastName: { equals: lastName, mode: "insensitive" },
      ...(excludeId && { id: { not: excludeId } }),
    },
    select: {
      id: true,
      firstName: true,
      middleName: true,
      lastName: true,
      email: true,
      role: true,
    },
    take: 5,
  });

  return NextResponse.json({ similarUsers });
}