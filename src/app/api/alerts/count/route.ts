import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildOperationalAlertWhere } from "@/lib/alerts/scope";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const where = buildOperationalAlertWhere({
    role: session.user.role,
    userId: session.user.id,
  });
  // SUPER_ADMIN / ADMIN see all plots within the operational lifecycle.

  const open = await prisma.alert.count({ where });
  return NextResponse.json({ open });
}
