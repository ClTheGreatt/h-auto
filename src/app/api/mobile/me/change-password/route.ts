import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getMobileUser } from "@/lib/mobile-auth";
import { passwordStrengthSchema } from "@/lib/validations/password";

export async function POST(req: NextRequest) {
  const user = await getMobileUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Both current and new password are required" },
        { status: 400 }
      );
    }
    const strength = passwordStrengthSchema.safeParse(newPassword);
    if (!strength.success) {
      return NextResponse.json(
        { error: strength.error.issues[0]?.message ?? "Password is too weak" },
        { status: 400 }
      );
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true },
    });
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const valid = await bcrypt.compare(currentPassword, dbUser.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 401 }
      );
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newHash,
        tokenVersion: { increment: 1 },
        mustChangePassword: false,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[mobile/me/change-password] error:", error);
    return NextResponse.json(
      { error: "Failed to change password" },
      { status: 500 }
    );
  }
}