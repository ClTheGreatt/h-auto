import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileUser } from "@/lib/mobile-auth";

function isAdmin(role: string) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

const VALID_STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED"];

// PATCH /api/mobile/me/users/[id] — update a user's status (admin only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getMobileUser(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(actor.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  // Can't change your own status (avoids locking yourself out)
  if (id === actor.id) {
    return NextResponse.json(
      { error: "You can't change your own status" },
      { status: 400 }
    );
  }

  try {
    const body = await req.json();
    const status = body.status;

    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });
    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Same permission rules as creating: nobody manages SUPER_ADMIN from mobile,
    // and only SUPER_ADMIN can manage ADMIN accounts.
    if (target.role === "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Super Admin accounts can't be managed from mobile" },
        { status: 403 }
      );
    }
    if (target.role === "ADMIN" && actor.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only Super Admins can manage Admin accounts" },
        { status: 403 }
      );
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { status },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
      },
    });

    return NextResponse.json({ user: updated });
  } catch (error) {
    console.error("[mobile/me/users/[id] PATCH] error:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}