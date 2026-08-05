import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileUser } from "@/lib/mobile-auth";
import { isInactivePrefixed, stripInactivePrefix } from "@/lib/users/inactive-prefix";

function isAdmin(role: string) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

const VALID_STATUSES = ["ACTIVE", "INACTIVE"];

// GET /api/mobile/me/users/[id] — fetch one user's full detail (admin only)
export async function GET(
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

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        middleName: true,
        lastName: true,
        phoneNumber: true,
        role: true,
        idNumber: true,
        department: true,
        course: true,
        yearLevel: true,
        section: true,
        academicYear: true,
        graduatedAt: true,
        position: true,
        profileImage: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Self-view is always allowed, regardless of role hierarchy — an admin
    // fetching their own record shouldn't be blocked by the ADMIN/SUPER_ADMIN
    // target rules below. Everyone else goes through the same permission
    // rules as PATCH: nobody views SUPER_ADMIN from mobile, and only
    // SUPER_ADMIN can view ADMIN accounts.
    if (id !== actor.id) {
      if (user.role === "SUPER_ADMIN") {
        return NextResponse.json(
          { error: "Super Admin accounts can't be viewed from mobile" },
          { status: 403 }
        );
      }
      if (user.role === "ADMIN" && actor.role !== "SUPER_ADMIN") {
        return NextResponse.json(
          { error: "Only Super Admins can view Admin accounts" },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({
      user: {
        ...user,
        // Read-path only: deactivateUser() prefixes email with
        // inactive_<timestamp>_ to free the unique constraint. A client has
        // no use for that internal encoding — status is already returned,
        // so "this account is inactive" is knowable without leaking it.
        email: stripInactivePrefix(user.email),
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
        graduatedAt: user.graduatedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error("[mobile/me/users/[id] GET] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    );
  }
}

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
      select: { id: true, role: true, status: true, email: true },
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

    // Reactivation: INACTIVE -> ACTIVE. Mirrors updateUser()'s email-restore
    // logic (src/actions/users.ts) — deactivateUser() prefixed the email to
    // free the unique constraint, so reactivating must strip it back off.
    // Unlike the web edit form, this PATCH body never carries an email
    // field, so the prefixed value is always read from the stored record
    // itself (target.email), never from client input.
    const isReactivating = target.status === "INACTIVE" && status === "ACTIVE";
    const updateData: Record<string, unknown> = { status };

    if (isReactivating && isInactivePrefixed(target.email)) {
      const finalEmail = stripInactivePrefix(target.email);

      const conflict = await prisma.user.findFirst({
        where: {
          email: { equals: finalEmail, mode: "insensitive" },
          id: { not: id },
          status: "ACTIVE",
        },
      });

      if (conflict) {
        return NextResponse.json(
          {
            error: `Cannot reactivate: another active user (${conflict.firstName} ${conflict.lastName}) is using ${finalEmail}.`,
          },
          { status: 409 }
        );
      }

      updateData.email = finalEmail;
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
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