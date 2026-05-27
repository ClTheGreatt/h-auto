import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const where: Prisma.AlertWhereInput = { resolved: false };

  if (session.user.role === "STUDENT_FARMER") {
    where.plot = {
      assignments: { some: { studentId: session.user.id, status: "ACTIVE" } },
    };
  } else if (session.user.role === "FACULTY") {
    where.plot = {
      assignments: { some: { facultyId: session.user.id, status: "ACTIVE" } },
    };
  }
  // SUPER_ADMIN / ADMIN → lahat ng plots (walang filter)

  const open = await prisma.alert.count({ where });
  return NextResponse.json({ open });
}